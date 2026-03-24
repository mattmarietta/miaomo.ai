import {describe, it, expect, vi, beforeEach} from "vitest";

// Mock before importing the module under test
vi.mock("pdf-parse/lib/pdf-parse.js", () => ({
  default: vi.fn(),
}));

import {extractPdfText} from "../ingest/pdf.js";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const mockPdfParse = vi.mocked(pdfParse);

describe("extractPdfText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns extracted text from a PDF buffer", async () => {
    mockPdfParse.mockResolvedValue({text: "Hello from the PDF."} as any);
    const buf = Buffer.from("fake-pdf-bytes");
    const text = await extractPdfText(buf);
    expect(text).toBe("Hello from the PDF.");
  });

  it("passes the buffer directly to pdf-parse", async () => {
    mockPdfParse.mockResolvedValue({text: "content"} as any);
    const buf = Buffer.from("some bytes");
    await extractPdfText(buf);
    expect(mockPdfParse).toHaveBeenCalledWith(buf);
    expect(mockPdfParse).toHaveBeenCalledTimes(1);
  });

  it("returns an empty string when pdf-parse returns undefined text", async () => {
    mockPdfParse.mockResolvedValue({text: undefined} as any);
    const text = await extractPdfText(Buffer.alloc(0));
    expect(text).toBe("");
  });

  it("returns an empty string when pdf-parse returns null text", async () => {
    mockPdfParse.mockResolvedValue({text: null} as any);
    const text = await extractPdfText(Buffer.alloc(0));
    expect(text).toBe("");
  });

  it("propagates errors thrown by pdf-parse", async () => {
    mockPdfParse.mockRejectedValue(new Error("PDF is corrupt"));
    await expect(extractPdfText(Buffer.alloc(0))).rejects.toThrow("PDF is corrupt");
  });
});
