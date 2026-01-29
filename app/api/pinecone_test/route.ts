import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

type ChunkMeta = {
  userId: string;
  docId: string;
  chunkIndex: number;
  source: string;
  chunkText: string; 
};

export async function GET() {
  const indexName = process.env.PINECONE_INDEX_NAME;
  const pineconeKey = process.env.PINECONE_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY;

  if (!indexName || !pineconeKey || !googleKey) {
    return Response.json(
      { ok: false, error: "Missing env vars: PINECONE_INDEX_NAME / PINECONE_API_KEY / GOOGLE_API_KEY" },
      { status: 500 }
    );
  }

  // Create Pinecone client and google embedding instance
  const pc = new Pinecone({ apiKey: pineconeKey });
  // Later: namespace per user
  const index = pc.index<ChunkMeta>(indexName).namespace("matt-test-1");

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: googleKey,
    model: "gemini-embedding-001",
  });

  // Test sample chunks
  const chunks = [
    "RAG retrieves relevant chunks from a vector database and adds them to the model context.",
    "Pinecone stores dense vectors and returns the topK most similar vectors for a query.",
    "Metadata filters (userId/docId) prevent cross-user data leakage in multi-tenant apps.",
  ];

  // Dimensionality must be 3072 or else Pinecone will error on upsert
  const docVectors = await embeddings.embedDocuments(chunks);
  const dim = docVectors[0]?.length ?? 0;
  if (dim !== 3072) {
    return Response.json(
      {
        ok: false,
        error: `Embedding dimension mismatch. Expected 3072 (your Pinecone index), got ${dim}.`,
        hint:
          "Make sure you are using gemini-embedding-001 and not truncating dimensions. Google docs say default is 3072 unless output_dimensionality is set.",
      },
      { status: 500 }
    );
  }

  // Upsert into Pinecone Vector DB
  await index.upsert(
    chunks.map((text, i) => ({
      id: `matt-docA-${i}`,
      values: docVectors[i],
      metadata: {
        userId: "matt",
        docId: "docA",
        chunkIndex: i,
        source: "pinecone-test",
        chunkText: text,
      },
    }))
  );

  // Query
  const q = "How does RAG use a vector database?";
  const qVec = await embeddings.embedQuery(q);

  const results = await index.query({
    vector: qVec,
    topK: 3,
    includeMetadata: true,
  });

  return Response.json({
    ok: true,
    indexName,
    namespace: "matt-test-1",
    embeddingDim: dim,
    query: q,
    matches: results.matches?.map((m) => ({
      id: m.id,
      score: m.score,
      meta: m.metadata,
    })),
  });
}