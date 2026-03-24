// The pdf-parse package doesn't ship types for its internal subpath.
// We import from pdf-parse/lib/pdf-parse.js directly to avoid a debug-mode
// bug (see src/ingest/pdf.ts), so we declare the module manually here.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: Record<string, unknown>): Promise<PdfData>;
  export default pdfParse;
}
