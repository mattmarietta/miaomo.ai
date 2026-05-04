import {GoogleGenerativeAIEmbeddings} from "@langchain/google-genai";
import {Pinecone} from "@pinecone-database/pinecone";

export type SparseVector = {indices: number[]; values: number[]};

const SPARSE_MODEL = "pinecone-sparse-english-v0";

export function getEmbeddingsClient() {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) {
    throw new Error("Missing env var: GOOGLE_API_KEY");
  }

  // Create the embedding instance
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: googleKey,
    model: "gemini-embedding-001",
  });

  return embeddings;
}

function getPineconeInferenceClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("Missing env var: PINECONE_API_KEY");
  return new Pinecone({apiKey});
}

// Pinecone inference returns { sparseValues, sparseIndices }; storage/query expect { indices, values }.
function toSparseVector(emb: {sparseIndices?: number[]; sparseValues?: number[]}): SparseVector {
  if (!emb.sparseIndices || !emb.sparseValues) {
    throw new Error("Pinecone sparse embedding response missing sparseIndices/sparseValues");
  }
  return {indices: emb.sparseIndices, values: emb.sparseValues};
}

// Two functions, one for document embedding and one for query embedding
export async function embedDocuments(texts: string[]) {
  const emb = getEmbeddingsClient();
  const vectors = await emb.embedDocuments(texts);
  return vectors;
}

export async function embedQuery(text: string) {
  const emb = getEmbeddingsClient();
  const vector = await emb.embedQuery(text);
  return vector;
}

export async function embedSparseDocuments(texts: string[]): Promise<SparseVector[]> {
  if (texts.length === 0) return [];
  const pc = getPineconeInferenceClient();
  const res = await pc.inference.embed(SPARSE_MODEL, texts, {
    inputType: "passage",
    truncate: "END",
  });
  return (res.data ?? []).map((d) =>
    toSparseVector(d as {sparseIndices?: number[]; sparseValues?: number[]})
  );
}

export async function embedSparseQuery(text: string): Promise<SparseVector> {
  const pc = getPineconeInferenceClient();
  const res = await pc.inference.embed(SPARSE_MODEL, [text], {
    inputType: "query",
    truncate: "END",
  });
  const first = res.data?.[0];
  if (!first) throw new Error("Pinecone sparse embed returned no data");
  return toSparseVector(first as {sparseIndices?: number[]; sparseValues?: number[]});
}


