import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export function GetEmbeddingsClient(){
    const googleKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
    if (!googleKey) {
        throw new Error("Missing env var: GOOGLE_AI_STUDIO_API_KEY");
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
  const emb = GetEmbeddingsClient();
  const vectors = await emb.embedDocuments(texts);
  return vectors;
}

export async function embedQuery(text: string) {
  if (!text || typeof text !== "string") {
    throw new Error(`embedQuery received invalid input: ${typeof text}`);
  }
  const emb = GetEmbeddingsClient();
  const vector = await emb.embedQuery(text);
  return vector;
}


