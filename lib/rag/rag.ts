import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { retrieveContext } from "./retrieve";

const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-3-pro-preview",
});

const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful research assistant.
Answer ONLY based on the provided context.
If you don't know, say so.

Context:
{context}

Question: {question}

Answer:`);

// Format chunks nicely
const formatContext = (chunks: any[]) => {
  if (chunks.length === 0) return "No relevant documents found.";
  return chunks
    .map((c, i) => `[${i + 1}] ${c.text}`)
    .join("\n\n");
};

// Rag chain for function
export async function ragChain(params: {
  question: string;
  userId: string;
  docId?: string;
  topK?: number;
}) {
  const { question, userId, docId, topK = 5 } = params;

  // Step 1: Get chunks from Pinecone
  const chunks = await retrieveContext({
    userId,
    query: question,
    docId,
    topK,
  });

  // Format them nicely with function
  const context = formatContext(chunks);

  // Ask Gemini
  const answer = await promptTemplate
    .pipe(llm)
    .pipe(new StringOutputParser())
    .invoke({
      context,
      question,
    });

  // Return with sources
  return {
    answer,
    sources: chunks.map((c) => ({
      docId: c.docId,
      source: c.source,
      score: c.score,
    })),
  };
}