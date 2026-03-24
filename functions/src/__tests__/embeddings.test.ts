import {describe, it, expect, vi, beforeEach} from "vitest";

// vi.mock is hoisted before imports in ESM — use vi.hoisted() so these
// variables are initialised before the factory function runs.
const {mockEmbedDocuments, mockEmbedQuery} = vi.hoisted(() => ({
  mockEmbedDocuments: vi.fn(),
  mockEmbedQuery: vi.fn(),
}));

vi.mock("@langchain/google-genai", () => ({
  GoogleGenerativeAIEmbeddings: vi.fn(function () {
    return {embedDocuments: mockEmbedDocuments, embedQuery: mockEmbedQuery};
  }),
}));

import {embedDocuments, embedQuery} from "../embeddings.js";
import {GoogleGenerativeAIEmbeddings} from "@langchain/google-genai";

const MockEmbeddings = vi.mocked(GoogleGenerativeAIEmbeddings);

const fakeVector = (dim = 3072) => Array.from({length: dim}, () => Math.random());

describe("embedDocuments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one vector per input text", async () => {
    const texts = ["chunk one", "chunk two", "chunk three"];
    const fakeVectors = texts.map(() => fakeVector());
    mockEmbedDocuments.mockResolvedValue(fakeVectors);

    const result = await embedDocuments(texts);
    expect(result).toHaveLength(3);
    expect(result).toEqual(fakeVectors);
  });

  it("calls the Gemini client with the correct texts", async () => {
    const texts = ["hello world"];
    mockEmbedDocuments.mockResolvedValue([fakeVector()]);

    await embedDocuments(texts);
    expect(mockEmbedDocuments).toHaveBeenCalledWith(texts);
    expect(mockEmbedDocuments).toHaveBeenCalledTimes(1);
  });

  it("initialises the client with the gemini-embedding-001 model", async () => {
    mockEmbedDocuments.mockResolvedValue([fakeVector()]);
    await embedDocuments(["text"]);

    expect(MockEmbeddings).toHaveBeenCalledWith(
      expect.objectContaining({model: "gemini-embedding-001"})
    );
  });

  it("throws when GOOGLE_API_KEY is not set", async () => {
    const original = process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    await expect(embedDocuments(["text"])).rejects.toThrow("GOOGLE_API_KEY");

    process.env.GOOGLE_API_KEY = original;
  });

  it("propagates errors from the Gemini client", async () => {
    mockEmbedDocuments.mockRejectedValue(new Error("Rate limit exceeded"));
    await expect(embedDocuments(["text"])).rejects.toThrow("Rate limit exceeded");
  });
});

describe("embedQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a single vector for one query string", async () => {
    const vec = fakeVector();
    mockEmbedQuery.mockResolvedValue(vec);

    const result = await embedQuery("what is a vector database?");
    expect(result).toEqual(vec);
    expect(result).toHaveLength(3072);
  });

  it("calls the Gemini client with the query text", async () => {
    mockEmbedQuery.mockResolvedValue(fakeVector());

    await embedQuery("my query");
    expect(mockEmbedQuery).toHaveBeenCalledWith("my query");
    expect(mockEmbedQuery).toHaveBeenCalledTimes(1);
  });
});
