import {Pinecone, type RecordMetadata} from "@pinecone-database/pinecone";
import type {SparseVector} from "./embeddings.ts";

export type ChunkMeta = RecordMetadata & {
  fileId: string;
  chunkIndex: number;
  source: string;
  page?: number;
  chunkText?: string;
};

function getPineconeClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("Missing env var: PINECONE_API_KEY");
  return new Pinecone({apiKey});
}

let cachedHost: string | null = null;

async function getIndexHost(pc: Pinecone): Promise<string> {
  const hostFromEnv = process.env.PINECONE_INDEX_HOST;
  if (hostFromEnv) return hostFromEnv;

  if (cachedHost) return cachedHost;

  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) throw new Error("Missing env var: PINECONE_INDEX_NAME");

  const model = await pc.describeIndex(indexName);
  cachedHost = model.host;
  return model.host;
}

export async function getWorkspaceIndex(workspaceId: string) {
  const pc = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME;
  if (!indexName) throw new Error("Missing env var: PINECONE_INDEX_NAME");
  const host = await getIndexHost(pc);

  return pc.index<ChunkMeta>(indexName, host).namespace(workspaceId);
}

export async function upsertChunks(params: {
    workspaceId: string;
    fileId: string;
    vectors: number[][];
    sparseVectors: SparseVector[];
    chunks: {chunkText: string; chunkIndex: number; source: string; page?: number}[];
  }) {
  const {workspaceId, fileId, vectors, sparseVectors, chunks} = params;
  const index = await getWorkspaceIndex(workspaceId);

  if (vectors.length !== chunks.length) {
    throw new Error(`Vectors/chunks length mismatch: ${vectors.length} vs ${chunks.length}`);
  }
  if (sparseVectors.length !== vectors.length) {
    throw new Error(
      `sparse/dense length mismatch: ${sparseVectors.length} sparse vs ${vectors.length} dense`
    );
  }

  const dim = vectors[0]?.length ?? 0;
  if (dim !== 3072) {
    throw new Error(`Embedding dimension mismatch: expected 3072, got ${dim}`);
  }
  for (const v of vectors) {
    if (v.length !== dim) throw new Error("Inconsistent embedding dimensions in batch");
  }

  const records = chunks.map((c, i) => ({
    id: `${fileId}:${c.chunkIndex}`,
    values: vectors[i],
    sparseValues: {
      indices: sparseVectors[i].indices,
      values: sparseVectors[i].values,
    },
    metadata: {
      fileId,
      chunkIndex: c.chunkIndex,
      source: c.source,
      chunkText: c.chunkText,
      ...(c.page !== undefined ? {page: c.page} : {}),
    } satisfies ChunkMeta,
  }));

  await index.upsert(records);

  return {inserted: records.length, dim};
}

// Default hybrid weighting: dense * alpha, sparse * (1 - alpha).
export const DEFAULT_HYBRID_ALPHA = 0.75;

function scaleHybrid(
  dense: number[],
  sparse: SparseVector,
  alpha: number
): {dense: number[]; sparse: SparseVector} {
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
  const index = await getWorkspaceIndex(workspaceId);

  const scaled = scaleHybrid(denseVector, sparseVector, alpha);

  const res = await index.query({
    vector: scaled.dense,
    sparseVector: scaled.sparse,
    topK,
    includeMetadata: true,
    ...(fileId ? {filter: {fileId: {$eq: fileId}}} : {}),
  });

  return (res.matches ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
