import {describe, it, expect, vi, beforeEach} from "vitest";

// vi.hoisted() ensures these are initialised before the hoisted vi.mock() factory runs.
const {mockUpsert, mockQuery, mockNamespace, mockIndex, mockDescribeIndex} = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockQuery: vi.fn(),
  mockNamespace: vi.fn(),
  mockIndex: vi.fn(),
  mockDescribeIndex: vi.fn(),
}));

vi.mock("@pinecone-database/pinecone", () => ({
  Pinecone: vi.fn(function () {
    return {index: mockIndex, describeIndex: mockDescribeIndex};
  }),
}));

// Wire the index chain: index(name, host) → { namespace } → { upsert, query }
mockNamespace.mockReturnValue({upsert: mockUpsert, query: mockQuery});
mockIndex.mockReturnValue({namespace: mockNamespace});
mockDescribeIndex.mockResolvedValue({host: "https://test-host.pinecone.io"});

import {upsertChunks, queryTopK} from "../pinecone.js";

const vec = (dim = 3072) => Array.from({length: dim}, () => 0.1);

const baseChunks = [
  {chunkIndex: 0, chunkText: "chunk zero", source: "gs://bucket/file.pdf"},
  {chunkIndex: 1, chunkText: "chunk one", source: "gs://bucket/file.pdf"},
];

describe("upsertChunks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls Pinecone upsert with correctly shaped records", async () => {
    mockUpsert.mockResolvedValue({upsertedCount: 2});
    // Reset chain after clearAllMocks
    mockNamespace.mockReturnValue({upsert: mockUpsert, query: mockQuery});
    mockIndex.mockReturnValue({namespace: mockNamespace});
    mockDescribeIndex.mockResolvedValue({host: "https://test-host.pinecone.io"});

    await upsertChunks({
      workspaceId: "ws-1",
      fileId: "file-1",
      vectors: [vec(), vec()],
      chunks: baseChunks,
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [records] = mockUpsert.mock.calls[0] as any;
    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("file-1:0");
    expect(records[1].id).toBe("file-1:1");
    expect(records[0].values).toHaveLength(3072);
    expect(records[0].metadata.fileId).toBe("file-1");
    expect(records[0].metadata.chunkText).toBe("chunk zero");
  });

  it("namespaces by workspaceId", async () => {
    mockUpsert.mockResolvedValue({});
    mockNamespace.mockReturnValue({upsert: mockUpsert, query: mockQuery});
    mockIndex.mockReturnValue({namespace: mockNamespace});
    mockDescribeIndex.mockResolvedValue({host: "https://test-host.pinecone.io"});

    await upsertChunks({
      workspaceId: "my-workspace",
      fileId: "f",
      vectors: [vec()],
      chunks: [baseChunks[0]],
    });

    expect(mockNamespace).toHaveBeenCalledWith("my-workspace");
  });

  it("returns inserted count and dimension", async () => {
    mockUpsert.mockResolvedValue({});
    mockNamespace.mockReturnValue({upsert: mockUpsert, query: mockQuery});
    mockIndex.mockReturnValue({namespace: mockNamespace});
    mockDescribeIndex.mockResolvedValue({host: "https://test-host.pinecone.io"});

    const {inserted, dim} = await upsertChunks({
      workspaceId: "ws",
      fileId: "f",
      vectors: [vec(), vec()],
      chunks: baseChunks,
    });

    expect(inserted).toBe(2);
    expect(dim).toBe(3072);
  });

  it("throws when embedding dimension is not 3072", async () => {
    await expect(
      upsertChunks({
        workspaceId: "ws",
        fileId: "f",
        vectors: [vec(512)],
        chunks: [baseChunks[0]],
      })
    ).rejects.toThrow("expected 3072, got 512");
  });

  it("throws when vectors and chunks arrays have different lengths", async () => {
    await expect(
      upsertChunks({
        workspaceId: "ws",
        fileId: "f",
        vectors: [vec(), vec()],
        chunks: [baseChunks[0]],
      })
    ).rejects.toThrow("length mismatch");
  });

  it("throws when vectors have inconsistent dimensions", async () => {
    await expect(
      upsertChunks({
        workspaceId: "ws",
        fileId: "f",
        vectors: [vec(3072), vec(1536)],
        chunks: baseChunks,
      })
    ).rejects.toThrow("Inconsistent embedding dimensions");
  });
});

describe("queryTopK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNamespace.mockReturnValue({upsert: mockUpsert, query: mockQuery});
    mockIndex.mockReturnValue({namespace: mockNamespace});
    mockDescribeIndex.mockResolvedValue({host: "https://test-host.pinecone.io"});
  });

  it("queries with the correct vector and topK", async () => {
    mockQuery.mockResolvedValue({matches: []});

    await queryTopK({workspaceId: "ws", queryVector: vec(), topK: 5});

    const [args] = mockQuery.mock.calls[0] as any;
    expect(args.vector).toHaveLength(3072);
    expect(args.topK).toBe(5);
    expect(args.includeMetadata).toBe(true);
  });

  it("applies a fileId filter when provided", async () => {
    mockQuery.mockResolvedValue({matches: []});

    await queryTopK({workspaceId: "ws", queryVector: vec(), topK: 3, fileId: "file-99"});

    const [args] = mockQuery.mock.calls[0] as any;
    expect(args.filter).toEqual({fileId: {$eq: "file-99"}});
  });

  it("does not add a filter when fileId is omitted", async () => {
    mockQuery.mockResolvedValue({matches: []});

    await queryTopK({workspaceId: "ws", queryVector: vec(), topK: 3});

    const [args] = mockQuery.mock.calls[0] as any;
    expect(args.filter).toBeUndefined();
  });

  it("returns matches sorted by score descending", async () => {
    mockQuery.mockResolvedValue({
      matches: [
        {id: "a", score: 0.5, metadata: {}},
        {id: "b", score: 0.9, metadata: {}},
        {id: "c", score: 0.7, metadata: {}},
      ],
    });

    const results = await queryTopK({workspaceId: "ws", queryVector: vec(), topK: 3});

    expect(results[0].score).toBe(0.9);
    expect(results[1].score).toBe(0.7);
    expect(results[2].score).toBe(0.5);
  });

  it("returns an empty array when there are no matches", async () => {
    mockQuery.mockResolvedValue({matches: undefined});

    const results = await queryTopK({workspaceId: "ws", queryVector: vec(), topK: 5});
    expect(results).toEqual([]);
  });
});
