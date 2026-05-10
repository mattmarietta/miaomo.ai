import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { serverAuth, serverDB } from "@/lib/firebase/firebaseServer";
import { retrieveContext } from "@/lib/rag/retrieve";

// schema for mindmap nodes
const mindmapSchema = z.object({
  title: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      summary: z.string(),
      children: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          summary: z.string(),
        })
      ),
    })
  ),
});

const BROAD_QUERY = "main topics, key concepts, and important ideas";
const CHARS_PER_FILE = 15000;
const PER_FILE_TOPK = 10;
const MAX_CHUNKS = 60;

export async function POST(req: NextRequest) {
  try {
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

    const { workspaceId } = (await req.json()) as { workspaceId?: string };
    if (!workspaceId) {
      return NextResponse.json(
        { error: "workspaceId is required" },
        { status: 400 }
      );
    }

    const filesSnap = await serverDB
      .collection("workspaces")
      .doc(workspaceId)
      .collection("files")
      .where("ownerUid", "==", userId)
      .get();

    if (filesSnap.empty) {
      return NextResponse.json({ root: "Mind Map", nodes: [] });
    }

    const fileIds = filesSnap.docs.map((d) => d.id);

    // Hybrid retrieval per file (rerank inside retrieveContext).
    const perFileChunks = await Promise.all(
      fileIds.map((fileId) =>
        retrieveContext({
          workspaceId,
          query: BROAD_QUERY,
          topK: PER_FILE_TOPK,
          fileId,
        }).catch(() => [])
      )
    );

    const pineconeText = perFileChunks
      .flat()
      .map((c) => c.text ?? "")
      .filter((t) => t.trim().length > 0)
      .slice(0, MAX_CHUNKS)
      .join("\n---\n");

    // Fallback: when ingestion hasn't run yet, pull raw fullText from Firestore.
    const firestoreText = filesSnap.docs
      .map((doc) => {
        const text: string = (doc.data().fullText as string | undefined) ?? "";
        return text.trim().slice(0, CHARS_PER_FILE);
      })
      .filter((t) => t.length > 0)
      .join("\n---\n");

    const sourceText = pineconeText || firestoreText;
    if (!sourceText) {
      return NextResponse.json({ root: "Mind Map", nodes: [] });
    }

    const { output } = await generateText({
      model: google("gemini-3-flash-preview"),
      output: Output.object({ schema: mindmapSchema }),
      prompt: `Analyze the following document excerpts from a study workspace and build a hierarchical mind map.
    Also generate a concise title (3-6 words) that captures the overall subject of the documents.
    Produce 4-8 main topic nodes, each with 2-4 sub-topic children.
    Each label should be 2-5 words. Each summary should be one sentence.
    Give every node a unique id like "topic1", "topic1-1", etc.

    Document excerpts:
    ${sourceText}`,
    });

    return NextResponse.json({
      root: output?.title ?? "Mind Map",
      nodes: output?.nodes ?? [],
    });
  } catch (err: unknown) {
    console.error("Mindmap API error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
