// POST a file here and get plain text back. The quiz builder and the flashcard
// builder both call this when a student uploads a PDF or image so we can feed
// the extracted text into the AI generators.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/extractText";

// Keep uploads reasonable — OCR on huge scans gets slow and expensive fast.
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_PAGES = 50;

export async function POST(req: NextRequest) {
  try {
    // Pull the file out of the multipart form.
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      const mb = Math.round(MAX_BYTES / 1024 / 1024);
      return NextResponse.json({ error: `File too big (max ${mb} MB)` }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    // Do the actual extraction (pdf-parse + OCR fallback under the hood).
    const result = await extractText(buffer, mimeType);

    // Cap the page count so someone can't accidentally OCR a 300-page textbook.
    if (result.pageCount && result.pageCount > MAX_PAGES) {
      return NextResponse.json(
        { error: `PDF is too long (max ${MAX_PAGES} pages)` },
        { status: 413 }
      );
    }

    if (!result.text.trim()) {
      return NextResponse.json(
        { error: "Couldn't find any text in this file. If it's a scan, try a clearer image." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: result.text,
      method: result.method,
      pageCount: result.pageCount,
      charCount: result.text.length,
    });
  } catch (err) {
    console.error("extract/text error:", err);
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
