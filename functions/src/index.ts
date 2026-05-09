import {onObjectFinalized, onObjectDeleted} from "firebase-functions/v2/storage";
import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getStorage} from "firebase-admin/storage";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

import {extractPdfText} from "./ingest/pdf.js";
import {chunkText} from "./ingest/chunk.js";
import {embedDocuments, embedSparseDocuments} from "./embeddings.js";
import {upsertChunks} from "./pinecone.js";

initializeApp();
const db = getFirestore();

function parsePath(name: string) {
  const parts = name.split("/").filter(Boolean);
  // workspaces/{workspaceId}/files/{fileId}/original.pdf
  if (parts.length < 5) return null;
  if (parts[0] !== "workspaces") return null;
  if (parts[2] !== "files") return null;

  const workspaceId = parts[1];
  const fileId = parts[3];
  const filename = parts.slice(4).join("/").toLowerCase();

  if (!filename.endsWith(".pdf")) return null;

  // skip common derived folders
  if (filename.includes("preview") || filename.includes("thumbnail") || filename.includes("export")) {
    return null;
  }

  return {workspaceId, fileId};
}

export const onUploadFinalized = onObjectFinalized(
  {
    region: "us-west1",
    bucket: "miaomo-64d4f.firebasestorage.app",
    secrets: ["PINECONE_API_KEY", "PINECONE_INDEX_NAME", "GOOGLE_API_KEY"],
  },
  async (event) => {
    console.log("[INGEST] handler invoked", {name: event.data?.name});

    const obj = event.data;
    if (!obj?.name) {
      console.log("[INGEST] skipping: no obj.name");
      return;
    }

    if (obj.name.endsWith("/")) {
      console.log("[INGEST] skipping: folder path");
      return;
    }
    if (!obj.size || Number(obj.size) === 0) {
      console.log("[INGEST] skipping: empty file");
      return;
    }

    const parsed = parsePath(obj.name);
    if (!parsed) {
      console.log("[INGEST] skipping: path did not match pattern", {name: obj.name});
      return;
    }

    const {workspaceId, fileId} = parsed;
    console.log("[INGEST] parsed path", {workspaceId, fileId});

    const ref = db.doc(`workspaces/${workspaceId}/files/${fileId}`);
    const generation = String(obj.generation ?? "");

    try {
      const shouldProcess = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : null;

        console.log("[INGEST] transaction check", {
          exists: snap.exists,
          docGeneration: data?.generation,
          eventGeneration: generation,
          status: data?.status,
        });

        if (
          data?.generation === generation &&
          (data?.status === "processing" || data?.status === "done")
        ) {
          return false;
        }

        tx.set(
          ref,
          {
            workspaceId,
            fileId,
            storagePath: obj.name,
            bucket: obj.bucket,
            contentType: obj.contentType ?? "",
            size: obj.size ? Number(obj.size) : 0,
            generation,
            status: "processing",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: data?.createdAt ?? FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
        return true;
      });

      if (!shouldProcess) {
        console.log("[INGEST] skipping: idempotency check (already processing/done)");
        return;
      }

      console.log("[INGEST] claimed, starting ingestion");

      const tmpPath = path.join(os.tmpdir(), `${fileId}-${generation}.pdf`);
      console.log("[INGEST] downloading", {tmpPath});

      await getStorage().bucket(obj.bucket).file(obj.name).download({destination: tmpPath});
      console.log("[INGEST] downloaded", {tmpPath});

      const buf = fs.readFileSync(tmpPath);

      const text = await extractPdfText(buf);
      console.log("[INGEST] extracted text", {textLen: text.length});

      if (!text.trim()) {
        throw new Error("No extractable text found in PDF (may be scanned).");
      }

      const chunks = await chunkText(text);
      const chunkTexts = chunks.map((c) => c.chunkText);
      console.log("[INGEST] chunked", {chunkCount: chunks.length});

      const [vectors, sparseVectors] = await Promise.all([
        embedDocuments(chunkTexts),
        embedSparseDocuments(chunkTexts),
      ]);
      console.log("[INGEST] embedded", {
        vectorCount: vectors.length,
        dim: vectors[0]?.length,
        sparseCount: sparseVectors.length,
      });

      const source = `gs://${obj.bucket}/${obj.name}`;
      const chunkPayload = chunks.map((c) => ({
        ...c,
        source,
      }));

      console.log("[INGEST] upserting to Pinecone", {workspaceId, fileId, records: vectors.length});

      const {inserted, dim} = await upsertChunks({
        workspaceId,
        fileId,
        vectors,
        sparseVectors,
        chunks: chunkPayload,
      });

      console.log("[INGEST] upserted", {inserted, dim});

      await ref.set(
        {
          status: "done",
          chunkCount: inserted,
          vectorCount: inserted,
          embeddingDim: dim,
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true}
      );

      console.log("[INGEST] done", {workspaceId, fileId});
    } catch (err: any) {
      console.error("[INGEST] FATAL error", {
        workspaceId,
        fileId,
        message: err?.message,
        stack: err?.stack,
      });
      try {
        await ref.set(
          {
            status: "error",
            errorMessage: err?.message ? String(err.message) : "Unknown ingestion error",
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true}
        );
      } catch (fsErr: any) {
        console.error("[INGEST] failed to write error status to Firestore", {message: fsErr?.message});
      }
      throw err;
    }
  }
);

export const onFileDeleted = onObjectDeleted(
  {
    region: "us-west1",
    bucket: "miaomo-64d4f.firebasestorage.app",
    secrets: ["PINECONE_API_KEY", "PINECONE_INDEX_NAME"],
  },
  async (event) => {
    const obj = event.data;
    if (!obj?.name) return;

    const parsed = parsePath(obj.name);
    if (!parsed) return;

    const {workspaceId, fileId} = parsed;
    console.log("[DELETE] starting cleanup", {workspaceId, fileId});

    const ref = db.doc(`workspaces/${workspaceId}/files/${fileId}`);

    try {
      // Read chunkCount from Firestore so we can reconstruct exact vector IDs.
      // Vector IDs are stored as "{fileId}:{chunkIndex}" — see upsertChunks in pinecone.ts.
      const snap = await ref.get();
      const chunkCount: number = snap.data()?.chunkCount ?? 0;

      if (chunkCount > 0) {
        const {getWorkspaceIndex} = await import("./pinecone.js");
        const index = await getWorkspaceIndex(workspaceId);
        const ids = Array.from({length: chunkCount}, (_, i) => `${fileId}:${i}`);
        await index.deleteMany(ids);
        console.log("[DELETE] removed vectors from Pinecone", {fileId, chunkCount});
      } else {
        console.log("[DELETE] no vectors to remove (chunkCount=0 or file never ingested)");
      }

      await ref.delete();
      console.log("[DELETE] removed Firestore document", {workspaceId, fileId});
    } catch (err: any) {
      console.error("[DELETE] error during cleanup", {workspaceId, fileId, message: err?.message});
      // Don't rethrow — a failed cleanup shouldn't block the Storage deletion
    }
  }
);

