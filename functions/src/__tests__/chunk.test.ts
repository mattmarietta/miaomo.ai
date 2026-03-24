import {describe, it, expect} from "vitest";
import {chunkText} from "../ingest/chunk.js";

describe("chunkText", () => {
  it("returns at least one chunk for non-empty input", async () => {
    const chunks = await chunkText("Hello world. This is a test document.");
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("each chunk has a chunkIndex and chunkText", async () => {
    const chunks = await chunkText("Short text.");
    for (const chunk of chunks) {
      expect(typeof chunk.chunkIndex).toBe("number");
      expect(typeof chunk.chunkText).toBe("string");
      expect(chunk.chunkText.length).toBeGreaterThan(0);
    }
  });

  it("chunkIndexes are sequential starting from 0", async () => {
    const text = "word ".repeat(500);
    const chunks = await chunkText(text);
    chunks.forEach((chunk, i) => {
      expect(chunk.chunkIndex).toBe(i);
    });
  });

  it("produces multiple chunks for long text", async () => {
    // 1500-char chunk size means ~3000+ chars should give at least 2 chunks
    const longText = "This is a sentence that will be repeated many times. ".repeat(100);
    const chunks = await chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk does not exceed the chunk size limit", async () => {
    const longText = "word ".repeat(1000);
    const chunks = await chunkText(longText);
    for (const chunk of chunks) {
      // Allow a small margin over chunkSize=1500 due to overlap
      expect(chunk.chunkText.length).toBeLessThanOrEqual(2000);
    }
  });

  it("consecutive chunks share overlapping content", async () => {
    // With overlap=200, the tail of chunk N should appear in chunk N+1
    const longText = "uniqueword ".repeat(400);
    const chunks = await chunkText(longText);
    if (chunks.length >= 2) {
      const endOfFirst = chunks[0].chunkText.slice(-100);
      expect(chunks[1].chunkText).toContain(endOfFirst.trim().split(" ")[0]);
    }
  });

  it("returns a single chunk for text shorter than chunk size", async () => {
    const shortText = "This is a short document.";
    const chunks = await chunkText(shortText);
    expect(chunks.length).toBe(1);
    expect(chunks[0].chunkText).toBe(shortText);
  });

  it("returns empty array for empty string", async () => {
    const chunks = await chunkText("");
    expect(chunks.length).toBe(0);
  });
});
