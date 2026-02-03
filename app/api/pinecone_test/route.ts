export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { embedDocuments } from "@/lib/rag/embeddings";
import { upsertChunks } from "@/lib/rag/pinecone";
import { retrieveContext } from "@/lib/rag/retrieve";


// Test Pinecone upsert and query from separate files
export async function GET() {
  const userId = "matt-test-1";
  const docId = "docA";

  const chunks = [
    "RAG retrieves relevant chunks from a vector database and adds them to the model context.",
    "Pinecone stores dense vectors and returns the topK most similar vectors for a query.",
    "Metadata filters (userId/docId) prevent cross-user data leakage in multi-tenant apps.",
  ].map((chunkText, chunkIndex) => ({
    chunkText,
    chunkIndex,
    source: "pinecone-test",
  }));

  const vectors = await embedDocuments(chunks.map((c) => c.chunkText));
  const upsertInfo = await upsertChunks({ userId, docId, vectors, chunks });

  const query = "How does RAG use a vector database?";
  const matches = await retrieveContext({ userId, query, topK: 3, docId });

  return Response.json({ ok: true, upsertInfo, query, matches });
}
