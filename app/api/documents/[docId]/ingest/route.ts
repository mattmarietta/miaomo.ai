export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { embedDocuments, embedSparseDocuments } from "@/lib/rag/embeddings";
import { upsertChunks } from "@/lib/rag/pinecone";
import { NextRequest } from "next/server";
import { serverAuth } from "@/lib/firebase/firebaseServer";
import { extractText, getDocumentProxy } from "unpdf";

interface RequestBody {
  text?: string;
  url?: string;
  source?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  workspaceId: string;
}

function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { chunkText: string; chunkIndex: number; source: string }[] {
  if (chunkSize <= 0) throw new Error("chunkSize must be positive");
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) throw new Error("chunkOverlap must be >= 0 and < chunkSize");

  const chunks: { chunkText: string; chunkIndex: number; source: string }[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({ chunkText: text.slice(start, end), chunkIndex, source: "" });
    chunkIndex++;
    start += chunkSize - chunkOverlap;
  }

  return chunks;
}

async function extractTextFromPdfUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  const buffer = new Uint8Array(await res.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    try {
      await serverAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    } catch {
      return Response.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const { docId } = await params;

    let body: RequestBody;
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.workspaceId) {
      return Response.json({ ok: false, error: "workspaceId is required" }, { status: 400 });
    }

    // Get text from body or extract from PDF URL
    let text: string;
    if (body.text && body.text.trim().length > 0) {
      text = body.text;
    } else if (body.url) {
      text = await extractTextFromPdfUrl(body.url);
    } else {
      return Response.json({ ok: false, error: "text or url is required" }, { status: 400 });
    }

    if (!text.trim()) {
      return Response.json({ ok: false, error: "No text extracted" }, { status: 400 });
    }

    const source = body.source || "user-upload";
    const chunkSize = body.chunkSize ?? 1500;
    const chunkOverlap = body.chunkOverlap ?? 200;

    let chunks = chunkText(text, chunkSize, chunkOverlap).map((c) => ({ ...c, source }));

    if (chunks.length === 0) {
      return Response.json({ ok: false, error: "No chunks generated from text" }, { status: 400 });
    }

    const BATCH_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batchChunks.map((c) => c.chunkText);

      const [vectorsBatch, sparseVectorsBatch] = await Promise.all([
        embedDocuments(batchTexts),
        embedSparseDocuments(batchTexts),
      ]);

      const result = await upsertChunks({
        workspaceId: body.workspaceId,
        docId,
        vectors: vectorsBatch,
        sparseVectors: sparseVectorsBatch,
        chunks: batchChunks,
      });

      totalInserted += result.inserted;
    }

    return Response.json({
      ok: true,
      docId,
      workspaceId: body.workspaceId,
      chunkCount: chunks.length,
      inserted: totalInserted,
      fullText: text,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
