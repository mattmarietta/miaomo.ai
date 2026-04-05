import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";

export type ChunkMeta = RecordMetadata & {
  fileId: string;
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

export function getWorkspaceIndex(workspaceId: string) {
    const indexName = process.env.PINECONE_INDEX_NAME;
    if (!indexName) {
        throw new Error("Missing env var: PINECONE_INDEX_NAME");
    }

    const pc = getPineconeClient();
    return pc.index<ChunkMeta>(indexName).namespace(workspaceId);
}

export async function queryTopK(params: {
  workspaceId: string;
  queryVector: number[];
  topK: number;
  fileId?: string;
}) {
  const { workspaceId, queryVector, topK, fileId } = params;
  const index = getWorkspaceIndex(workspaceId);

  const res = await index.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    ...(fileId ? { filter: { fileId: { $eq: fileId } } } : {}),
  });

  const matches = (res.matches ?? []).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return matches;
}
