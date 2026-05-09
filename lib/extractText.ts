// Pulls plain text out of whatever file the student uploads, so we can
// feed it straight into the quiz/flashcard generators.
//
// Strategy:
//   1. If it's an image → OCR it.
//   2. If it's a PDF → try pdf-parse first (fast + free for normal text PDFs).
//      If the result looks suspiciously empty, fall back to OCR (it's probably
//      a scanned PDF with no embedded text layer).
//   3. If it's a .txt → just decode the bytes.

import { ocrImage, ocrPdf } from "./ocr";

// If pdf-parse gives us fewer than this many chars per page, we assume the
// PDF is scanned/image-only and reach for OCR instead.
const MIN_CHARS_PER_PAGE = 50;

export type ExtractionResult = {
  text: string;
  method: "pdf-text" | "pdf-ocr" | "image-ocr" | "plain-text";
  pageCount?: number;
};

export async function extractText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
  // .txt and similar — nothing fancy, just decode.
  if (mimeType === "text/plain") {
    return { text: buffer.toString("utf-8"), method: "plain-text" };
  }

  // Images always go through OCR since there's no text layer to read.
  if (mimeType.startsWith("image/")) {
    const text = await ocrImage(buffer);
    return { text, method: "image-ocr" };
  }

  if (mimeType === "application/pdf") {
    const parsed = await tryPdfParse(buffer);

    // Sanity check: did pdf-parse actually find real text?
    const expected = Math.max(parsed.pages, 1) * MIN_CHARS_PER_PAGE;
    const looksEmpty = parsed.text.trim().length < expected;

    if (!looksEmpty) {
      return { text: parsed.text, method: "pdf-text", pageCount: parsed.pages };
    }

    // Probably a scan. Hand it off to OCR.
    const ocrText = await ocrPdf(buffer);
    return { text: ocrText, method: "pdf-ocr", pageCount: parsed.pages };
  }

  throw new Error(`Can't extract text from ${mimeType}`);
}

// Thin wrapper around pdf-parse v2. It's class-based: build a parser, call
// getText, then destroy it so pdfjs-dist releases its worker.
async function tryPdfParse(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await import("pdf-parse");
  // pdf-parse wants a Uint8Array-ish thing; Buffer is already one.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return { text: result.text || "", pages: result.total || 0 };
  } catch {
    // Encrypted / corrupt / weird PDF — fall through to the OCR path.
    return { text: "", pages: 0 };
  } finally {
    await parser.destroy();
  }
}
