import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import type { SparseVector } from "./embeddings";

export type ChunkMeta = RecordMetadata & {
  fileId: string;
  chunkIndex: number;
  source: string;
  page?: number;
  chunkText?: string;
};

// Default hybrid weighting: dense * alpha, sparse * (1 - alpha).
export const DEFAULT_HYBRID_ALPHA = 0.75;


function getPineconeClient(): Pinecone {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        throw new Error("Missing env var: PINECONE_API_KEY");
    }
    return new Pinecone({ apiKey });
}

export function getWorkspaceIndex(workspaceId: string) {
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
        throw new Error("Missing env var: PINECONE_INDEX_NAME");
    }

    const pc = getPineconeClient();
    return pc.index<ChunkMeta>(indexName).namespace(workspaceId);
}

// Client-side hybrid weighting for dotproduct indexes.
function scaleHybrid(
  dense: number[],
  sparse: SparseVector,
  alpha: number
): { dense: number[]; sparse: SparseVector } {
  if (alpha < 0 || alpha > 1) {
    throw new Error(`alpha must be in [0, 1], got ${alpha}`);
  }
  return {
    dense: dense.map((v) => v * alpha),
    sparse: {
      indices: sparse.indices,
      values: sparse.values.map((v) => v * (1 - alpha)),
    },
  };
}

export async function upsertChunks(params: {
  userId: string;
  docId: string;
  vectors: number[][];
  sparseVectors: SparseVector[];
  chunks: { chunkText: string; chunkIndex: number; source: string; page?: number }[];
}) {
  const { userId, docId, vectors, sparseVectors, chunks } = params;
  const index = getWorkspaceIndex(userId);

  if (sparseVectors.length !== vectors.length) {
    throw new Error(
      `sparse/dense length mismatch: ${sparseVectors.length} sparse vs ${vectors.length} dense`
    );
  }
  if (sparseVectors.length !== chunks.length) {
    throw new Error(
      `sparse/chunks length mismatch: ${sparseVectors.length} vs ${chunks.length}`
    );
  }

  const records = chunks.map((chunk, i) => ({
    id: `${docId}-chunk-${chunk.chunkIndex}`,
    values: vectors[i],
    sparseValues: {
      indices: sparseVectors[i].indices,
      values: sparseVectors[i].values,
    },
    metadata: {
      fileId: docId,
      chunkIndex: chunk.chunkIndex,
      source: chunk.source,
      chunkText: chunk.chunkText,
      ...(chunk.page !== undefined ? { page: chunk.page } : {}),
    } satisfies ChunkMeta,
  }));

  await index.upsert(records);
  return { inserted: records.length };
}

export async function queryTopK(params: {
  workspaceId: string;
  denseVector: number[];
  sparseVector: SparseVector;
  topK: number;
  fileId?: string;
  alpha?: number;
}) {
  const {
    workspaceId,
    denseVector,
    sparseVector,
    topK,
    fileId,
    alpha = DEFAULT_HYBRID_ALPHA,
  } = params;
  const index = getWorkspaceIndex(workspaceId);

  const scaled = scaleHybrid(denseVector, sparseVector, alpha);

  const res = await index.query({
    vector: scaled.dense,
    sparseVector: scaled.sparse,
    topK,
    includeMetadata: true,
    ...(fileId ? { filter: { fileId: { $eq: fileId } } } : {}),
  });

  const matches = (res.matches ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return matches;
}
