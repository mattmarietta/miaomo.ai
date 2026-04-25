export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { retrieveContext } from "@/lib/rag/retrieve";

// Test Pinecone query using workspace namespace
export async function GET() {
  const workspaceId = "test-workspace";

  const query = "How does RAG use a vector database?";
  const matches = await retrieveContext({ workspaceId, query, topK: 3 });

  return Response.json({ ok: true, query, matches });
}
