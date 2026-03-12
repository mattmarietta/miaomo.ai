import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";

export type ChunkMeta = RecordMetadata & {
  docId: string;
  chunkIndex: number;
  source: string;
  page?: number;
  chunkText?: string;
};


function getPineconeClient(): Pinecone {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
        throw new Error("Missing env var: PINECONE_API_KEY");
    }
    return new Pinecone({ apiKey });
}

export function getUserIndex(userId : string){
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
        throw new Error("Missing env var: PINECONE_INDEX_NAME");
    }

    const pc = getPineconeClient();
  // Namespace per user 
  return pc.index<ChunkMeta>(indexName).namespace(userId);
}

export async function upsertChunks(params: {
  userId: string;
  docId: string;
  vectors: number[][];
  chunks: { chunkText: string; chunkIndex: number; source: string; page?: number }[];
}) {
  const { userId, docId, vectors, chunks } = params;
  const index = getUserIndex(userId);

  if (vectors.length !== chunks.length) {
    throw new Error(`Vectors/chunks length mismatch: ${vectors.length} vs ${chunks.length}`);
  }

  const dim = vectors[0]?.length ?? 0;
  if (dim !== 3072) throw new Error(`Embedding dimension mismatch: expected 3072, got ${dim}`);

  const records = chunks.map((c, i) => {
    const metadata: ChunkMeta = {
      docId,
      chunkIndex: c.chunkIndex,
      source: c.source,
      chunkText: c.chunkText,
      ...(c.page !== undefined ? { page: c.page } : {}),
    };

    return {
      id: `${docId}:${c.chunkIndex}`,
      values: vectors[i],
      metadata,
    };
  });

  await index.upsert(records);

  return { inserted: chunks.length, dim };
}


export async function queryTopK(params: {
  userId: string;
  queryVector: number[];
  topK: number;
  docId?: string;
}) {
  const { userId, queryVector, topK, docId } = params;
  const index = getUserIndex(userId);

  const res = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    ...(docId ? { filter: { docId: { $eq: docId } } } : {}),
  });

  const matches = (res.matches ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return matches;
}