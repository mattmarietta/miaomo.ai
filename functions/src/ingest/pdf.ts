import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractPdfText(buffer: Buffer) {
  const res = await pdf(buffer);
  return res.text ?? "";
}
