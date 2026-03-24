import {GoogleGenerativeAIEmbeddings} from "@langchain/google-genai";

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


