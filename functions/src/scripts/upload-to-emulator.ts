/**
 * Uploads a PDF to the Firebase Storage emulator to trigger the onUploadFinalized function.
 *
 * Prerequisites:
 *   - Firebase emulators must be running: firebase emulators:start
 *
 * Usage:
 *   npm run build
 *   node lib/scripts/upload-to-emulator.js <path-to-pdf> [workspaceId] [fileId]
 *
 * Examples:
 *   node lib/scripts/upload-to-emulator.js ./test-files/sample.pdf
 *   node lib/scripts/upload-to-emulator.js ./test-files/sample.pdf my-workspace my-file-1
 *
 * Then watch the emulator terminal for [INGEST] checkpoint logs.
 */

import {initializeApp, cert, type ServiceAccount} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import * as fs from "fs";
import * as path from "path";

// ─── Point the Admin SDK at the local emulators ────────────────────────────
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const PROJECT_ID = "miaomo-64d4f";
const BUCKET = "miaomo-64d4f.firebasestorage.app";

// Use a fake credential — the emulator doesn't validate it
initializeApp({
  projectId: PROJECT_ID,
  storageBucket: BUCKET,
  credential: cert({
    projectId: PROJECT_ID,
    clientEmail: "fake@fake.com",
    privateKey: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3VS5JJcds3xHn/ygWep4PAtEsHAQPOCkdBjOMjJ0RFi8HFf4JRfMVBGJyL6ORVMR6RaXqPVqMZl8cDixbimEI5Q5OMhiASMuGIFvEbTbW8vL6b1zGaKW9mj1mVJq6MNRiI4VZB4\n-----END RSA PRIVATE KEY-----\n",
  } as ServiceAccount),
});

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("\nUsage: node lib/scripts/upload-to-emulator.js <path-to-pdf> [workspaceId] [fileId]");
    console.error("Example: node lib/scripts/upload-to-emulator.js ./test.pdf my-workspace file-001\n");
    process.exit(1);
  }

  const absPath = path.resolve(pdfPath);
  if (!fs.existsSync(absPath)) {
    console.error(`\nFile not found: ${absPath}\n`);
    process.exit(1);
  }

  const workspaceId = process.argv[3] ?? "test-workspace";
  const fileId = process.argv[4] ?? `test-file-${Date.now()}`;
  const destPath = `workspaces/${workspaceId}/files/${fileId}/original.pdf`;

  console.log("\n=== Emulator Upload ===");
  console.log(`PDF:         ${absPath} (${(fs.statSync(absPath).size / 1024).toFixed(1)} KB)`);
  console.log(`Destination: gs://${BUCKET}/${destPath}`);
  console.log(`WorkspaceId: ${workspaceId}`);
  console.log(`FileId:      ${fileId}`);
  console.log("======================\n");

  const storage = getStorage();
  console.log("Uploading to Storage emulator...");

  await storage.bucket(BUCKET).upload(absPath, {
    destination: destPath,
    metadata: {contentType: "application/pdf"},
  });

  console.log("✓ Upload complete!\n");
  console.log("Watch the emulator terminal for [INGEST] checkpoint logs:");
  console.log("  [INGEST] handler invoked");
  console.log("  [INGEST] parsed path");
  console.log("  [INGEST] transaction check");
  console.log("  [INGEST] claimed, starting ingestion");
  console.log("  [INGEST] downloading");
  console.log("  [INGEST] extracted text");
  console.log("  [INGEST] chunked");
  console.log("  [INGEST] embedded");
  console.log("  [INGEST] upserting to Pinecone");
  console.log("  [INGEST] done\n");
  console.log(`Firestore status: http://127.0.0.1:4000/firestore → workspaces/${workspaceId}/files/${fileId}`);
}

main().catch((err) => {
  console.error("\n✗ Upload failed:", err.message ?? err);
  process.exit(1);
});
