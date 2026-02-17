"use client";

import { useState } from "react";

export default function TestIngestPage() {
  const [docId, setDocId] = useState("test-doc-123");
  const [userId, setUserId] = useState("test-user-456");
  const [text, setText] = useState(
    "This is a sample document text that will be chunked and embedded. It contains multiple sentences to demonstrate the chunking functionality with overlap. The text will be split into chunks of the specified size, and each chunk will be embedded and stored in Pinecone. RAG retrieves relevant chunks from a vector database and adds them to the model context. Pinecone stores dense vectors and returns the topK most similar vectors for a query. Metadata filters (userId/docId) prevent cross-user data leakage in multi-tenant apps."
  );
  const [source, setSource] = useState("test-upload");
  const [chunkSize, setChunkSize] = useState(1200);
  const [chunkOverlap, setChunkOverlap] = useState(200);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch(`/api/documents/${docId}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          text,
          source,
          chunkSize,
          chunkOverlap,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResponse(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Test Ingestion Endpoint</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Document ID</label>
          <input
            type="text"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border rounded-md h-32"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Source</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chunk Size</label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Chunk Overlap</label>
            <input
              type="number"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md"
              min="0"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Ingest Document"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {response && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-semibold text-green-800 mb-2">Success</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
