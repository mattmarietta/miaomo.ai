import { embedQuery } from "./embeddings";
import { queryTopK } from "./pinecone";

export async function retrieveContext(params: {
  userId: string;
  query: string;
  topK?: number;
  docId?: string;
}) {
  const { userId, query, topK = 5, docId } = params;

  const qVec = await embedQuery(query);
  if ((qVec?.length ?? 0) !== 3072) {
    throw new Error(`Embedding dimension mismatch: expected 3072, got ${qVec.length}`);
  }

  const matches = await queryTopK({ userId, queryVector: qVec, topK, docId });

  return matches.map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    text: (m.metadata as any)?.chunkText ?? "",
    docId: (m.metadata as any)?.docId,
    source: (m.metadata as any)?.source,
    page: (m.metadata as any)?.page,
    chunkIndex: (m.metadata as any)?.chunkIndex,
  }));
}
