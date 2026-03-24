import {Pinecone, type RecordMetadata} from "@pinecone-database/pinecone";

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
    chunks: {chunkText: string; chunkIndex: number; source: string; page?: number}[];
  }) {
  const {workspaceId, fileId, vectors, chunks} = params;
  const index = await getWorkspaceIndex(workspaceId);

  if (vectors.length !== chunks.length) {
    throw new Error(`Vectors/chunks length mismatch: ${vectors.length} vs ${chunks.length}`);
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

export async function queryTopK(params: {
    workspaceId: string;
    queryVector: number[];
    topK: number;
    fileId?: string;
  }) {
  const {workspaceId, queryVector, topK, fileId} = params;
  const index = await getWorkspaceIndex(workspaceId);

  const res = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    ...(fileId ? {filter: {fileId: {$eq: fileId}}} : {}),
  });

  return (res.matches ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
