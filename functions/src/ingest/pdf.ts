import pdf from "pdf-parse";

export async function extractPdfText(buffer: Buffer) {
  const res = await pdf(buffer);
  return res.text ?? "";
}
