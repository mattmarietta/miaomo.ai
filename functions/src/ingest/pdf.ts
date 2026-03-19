// @ts-expect-error -- bypass pdf-parse debug-mode bug (reads test file when module.parent is null in ESM)
import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractPdfText(buffer: Buffer) {
  const res = await pdf(buffer);
  return res.text ?? "";
}
