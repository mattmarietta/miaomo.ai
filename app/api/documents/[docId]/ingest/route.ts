export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { embedDocuments } from "@/lib/rag/embeddings";
import { upsertChunks } from "@/lib/rag/pinecone";
import { NextRequest } from "next/server";

interface RequestBody {
  text: string;
  source?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  userId?: string;
}

/**
 * Simple character-based chunking with overlap
 */
function chunkText(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { chunkText: string; chunkIndex: number; source: string }[] {
  if (chunkSize <= 0) {
    throw new Error("chunkSize must be positive");
  }
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error("chunkOverlap must be >= 0 and < chunkSize");
  }

  const chunks: { chunkText: string; chunkIndex: number; source: string }[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.slice(start, end);
    
    chunks.push({
      chunkText,
      chunkIndex,
      source: "", 
    });

    chunkIndex++;
    start += chunkSize - chunkOverlap;
  }

  return chunks;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    // Parse request body
    let body: RequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return Response.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate text
    if (!body.text || typeof body.text !== "string" || body.text.trim().length === 0) {
      return Response.json(
        { ok: false, error: "text is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Determine userId: header first, then body
    const userIdFromHeader = request.headers.get("x-user-id");
    const userId = userIdFromHeader || body.userId;

    if (!userId || typeof userId !== "string") {
      return Response.json(
        { ok: false, error: "Missing userId. Provide via 'x-user-id' header or body.userId" },
        { status: 401 }
      );
    }

    // Set defaults
    const source = body.source || "user-upload";
    const chunkSize = body.chunkSize ?? 1200;
    const chunkOverlap = body.chunkOverlap ?? 200;

    // Validate chunking parameters
    if (chunkOverlap >= chunkSize) {
      return Response.json(
        { ok: false, error: "chunkOverlap must be less than chunkSize" },
        { status: 400 }
      );
    }

    // Chunk the text
    let chunks;
    try {
      chunks = chunkText(body.text, chunkSize, chunkOverlap);
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "Chunking failed" },
        { status: 400 }
      );
    }

    // Set source for all chunks
    chunks = chunks.map((chunk) => ({ ...chunk, source }));

    if (chunks.length === 0) {
      return Response.json(
        { ok: false, error: "No chunks generated from text" },
        { status: 400 }
      );
    }

    // Batch process 50 chunks at a time
    const BATCH_SIZE = 50;
    let totalInserted = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batchChunks.map((c) => c.chunkText);

      // Embed batch
      const vectorsBatch = await embedDocuments(batchTexts);

      // Upsert batch
      const result = await upsertChunks({
        userId,
        docId,
        vectors: vectorsBatch,
        chunks: batchChunks,
      });

      totalInserted += result.inserted;
    }

    return Response.json({
      ok: true,
      docId,
      userId,
      chunkCount: chunks.length,
      inserted: totalInserted,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

