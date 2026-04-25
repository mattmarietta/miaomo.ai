import { embedQuery } from "./embeddings";
import { queryTopK } from "./pinecone";

export async function retrieveContext(params: {
  workspaceId: string;
  query: string;
  topK?: number;
  fileId?: string;
}) {
  const { workspaceId, query, topK = 5, fileId } = params;

  const qVec = await embedQuery(query);
  if ((qVec?.length ?? 0) !== 3072) {
    throw new Error(`Embedding dimension mismatch: expected 3072, got ${qVec.length}`);
  }

  const matches = await queryTopK({ workspaceId, queryVector: qVec, topK, fileId });

  return matches.map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    text: (m.metadata as any)?.chunkText ?? "",
    fileId: (m.metadata as any)?.fileId,
    source: (m.metadata as any)?.source,
    page: (m.metadata as any)?.page,
    chunkIndex: (m.metadata as any)?.chunkIndex,
  }));
}
