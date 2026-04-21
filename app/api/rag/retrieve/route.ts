import { NextRequest, NextResponse } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { retrieveContext } from "@/lib/rag/retrieve";

/**
 * POST /api/rag/retrieve
 * Retrieves relevant chunks from Pinecone for the authenticated user.
 * Uses user-based namespaces (same as the client-side ingest pipeline).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let userId: string;
    try {
      const token = authHeader.split("Bearer ")[1];
      const decoded = await serverAuth.verifyIdToken(token);
      userId = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { query, topK = 8, workspaceId, fileId } = await req.json();

    if (!query || !workspaceId) {
      return NextResponse.json(
        { error: "query and workspaceId are required" },
        { status: 400 }
      );
    }

    const matches = await retrieveContext({
      workspaceId,
      query,
      topK,
      fileId,
    });

    return NextResponse.json({ matches });
  } catch (err: unknown) {
    console.error("RAG retrieve error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
