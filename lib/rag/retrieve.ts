import { Pinecone } from "@pinecone-database/pinecone";
import { embedQuery, embedSparseQuery } from "./embeddings";
import { queryTopK } from "./pinecone";

const RERANK_MODEL = "bge-reranker-v2-m3";
const RERANK_TOP_N = 5;

function getPineconeRerankClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error("Missing env var: PINECONE_API_KEY");
  return new Pinecone({ apiKey });
}

export async function retrieveContext(params: {
  workspaceId: string;
  query: string;
  topK?: number;
  fileId?: string;
}) {
  const { workspaceId, query, topK = 5, fileId } = params;

  const [denseVector, sparseVector] = await Promise.all([
    embedQuery(query),
    embedSparseQuery(query),
  ]);

  if ((denseVector?.length ?? 0) !== 3072) {
    throw new Error(`Embedding dimension mismatch: expected 3072, got ${denseVector.length}`);
  }

  // Retrieve more than we need so the reranker has room to reorder.
  const retrievalTopK = Math.max(topK, RERANK_TOP_N * 4);
  const matches = await queryTopK({
    workspaceId,
    denseVector,
    sparseVector,
    topK: retrievalTopK,
    fileId,
  });

  const candidates = matches.map((m) => ({
    id: m.id,
    score: m.score ?? 0,
    text: ((m.metadata as { chunkText?: string } | undefined)?.chunkText) ?? "",
    fileId: (m.metadata as { fileId?: string } | undefined)?.fileId,
    source: (m.metadata as { source?: string } | undefined)?.source,
    page: (m.metadata as { page?: number } | undefined)?.page,
    chunkIndex: (m.metadata as { chunkIndex?: number } | undefined)?.chunkIndex,
  }));

  const rerankable = candidates.filter((c) => c.text.trim().length > 0);
  if (rerankable.length === 0) {
    return candidates.slice(0, RERANK_TOP_N);
  }

  const pc = getPineconeRerankClient();
  const reranked = await pc.inference.rerank(
    RERANK_MODEL,
    query,
    rerankable.map((c) => ({ id: c.id, text: c.text })),
    {
      topN: RERANK_TOP_N,
      returnDocuments: false,
      rankFields: ["text"],
    }
  );

  return (reranked.data ?? []).map((r) => {
    const original = rerankable[r.index];
    return {
      ...original,
      score: r.score,
    };
  });
}
