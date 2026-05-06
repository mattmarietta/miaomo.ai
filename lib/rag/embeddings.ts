import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export type SparseVector = { indices: number[]; values: number[] };

const SPARSE_MODEL = "pinecone-sparse-english-v0";
const PINECONE_EMBED_URL = "https://api.pinecone.io/embed";

export function GetEmbeddingsClient() {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (!googleKey) throw new Error("Missing env var: GOOGLE_API_KEY");
  return new GoogleGenerativeAIEmbeddings({
    apiKey: googleKey,
    model: "gemini-embedding-001",
  });
}

// The Pinecone SDK v4 strips sparse_values out of inference responses (OpenAPI codegen bug).
// Call the REST API directly to get the full raw response.
async function pineconeEmbedRaw(
  texts: string[],
  inputType: "passage" | "query"
): Promise<SparseVector[]> {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("Missing env var: PINECONE_API_KEY");

  const body = {
    model: SPARSE_MODEL,
    inputs: texts.map((text) => ({ text })),
    parameters: { input_type: inputType, truncate: "END" },
  };

  const res = await fetch(PINECONE_EMBED_URL, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-Api-Version": "2024-10",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinecone embed API error ${res.status}: ${err}`);
  }

  const json = (await res.json()) as {
    data: Array<{ sparse_indices?: number[]; sparse_values?: number[] }>;
  };

  return json.data.map((item, i) => {
    if (!item.sparse_indices || !item.sparse_values) {
      throw new Error(`Pinecone sparse embed item ${i} missing sparse_indices/sparse_values`);
    }
    return { indices: item.sparse_indices, values: item.sparse_values };
  });
}

export async function embedDocuments(texts: string[]) {
  const emb = GetEmbeddingsClient();
  return emb.embedDocuments(texts);
}

export async function embedQuery(text: string) {
  if (!text || typeof text !== "string") {
    throw new Error(`embedQuery received invalid input: ${typeof text}`);
  }
  const emb = GetEmbeddingsClient();
  return emb.embedQuery(text);
}

export async function embedSparseDocuments(texts: string[]): Promise<SparseVector[]> {
  if (texts.length === 0) return [];
  return pineconeEmbedRaw(texts, "passage");
}

export async function embedSparseQuery(text: string): Promise<SparseVector> {
  if (!text || typeof text !== "string") {
    throw new Error(`embedSparseQuery received invalid input: ${typeof text}`);
  }
  const results = await pineconeEmbedRaw([text], "query");
  return results[0];
}
