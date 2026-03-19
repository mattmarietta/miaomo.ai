/**
 * Local test script — run with: npx ts-node --esm src/test-ingest.ts <path-to-pdf>
 * Or after building: node lib/test-ingest.js <path-to-pdf>
 *
 * This tests the entire ingest pipeline (PDF parse → chunk → embed → Pinecone upsert)
 * WITHOUT needing Firebase emulators or deploying anything.
 *
 * Usage:
 *   cd functions
 *   node -e "require('dotenv').config()" && node lib/test-ingest.js ./test-files/sample.pdf
 *
 * Or pipe in a PDF path as an argument:
 *   node --env-file=.env lib/test-ingest.js C:/path/to/your.pdf
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env so secrets are available
dotenv.config();

import {extractPdfText} from "./ingest/pdf.js";
import {chunkText} from "./ingest/chunk.js";
import {embedDocuments} from "./embeddings.js";
import {upsertChunks} from "./pinecone.js";

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: node lib/test-ingest.js <path-to-pdf>");
    process.exit(1);
  }

  const absPath = path.resolve(pdfPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const TEST_WORKSPACE_ID = "test-workspace";
  const TEST_FILE_ID = `test-file-${Date.now()}`;

  console.log("\n=== miaomo.ai Ingest Pipeline Test ===");
  console.log(`PDF:         ${absPath}`);
  console.log(`WorkspaceId: ${TEST_WORKSPACE_ID}`);
  console.log(`FileId:      ${TEST_FILE_ID}`);
  console.log("======================================\n");

  // 1. Read PDF
  console.log("Step 1: Reading PDF...");
  const buf = fs.readFileSync(absPath);
  console.log(`  → file size: ${(buf.length / 1024).toFixed(1)} KB`);

  // 2. Extract text
  console.log("\nStep 2: Extracting text...");
  const text = await extractPdfText(buf);
  if (!text.trim()) {
    console.error("  ✗ No text found — PDF may be scanned/image-only");
    process.exit(1);
  }
  console.log(`  → extracted ${text.length} characters`);
  console.log(`  → preview: "${text.slice(0, 120).replace(/\n/g, " ")}..."`);

  // 3. Chunk
  console.log("\nStep 3: Chunking text...");
  const chunks = await chunkText(text);
  console.log(`  → ${chunks.length} chunks (size=1500, overlap=200)`);

  // 4. Embed (only first 3 chunks to save quota during testing)
  const MAX_CHUNKS_FOR_TEST = 3;
  const testChunks = chunks.slice(0, MAX_CHUNKS_FOR_TEST);
  console.log(`\nStep 4: Embedding (first ${testChunks.length} chunks to conserve quota)...`);
  const vectors = await embedDocuments(testChunks.map((c) => c.chunkText));
  console.log(`  → got ${vectors.length} vectors, each dim=${vectors[0]?.length}`);

  // 5. Upsert to Pinecone
  console.log("\nStep 5: Upserting to Pinecone...");
  const source = `local-test://${absPath}`;
  const {inserted, dim} = await upsertChunks({
    workspaceId: TEST_WORKSPACE_ID,
    fileId: TEST_FILE_ID,
    vectors,
    chunks: testChunks.map((c) => ({...c, source})),
  });
  console.log(`  → inserted ${inserted} vectors (dim=${dim}) into namespace "${TEST_WORKSPACE_ID}"`);

  console.log("\n✓ Ingest pipeline test passed!\n");
  console.log(`To clean up, delete vectors with fileId prefix "${TEST_FILE_ID}" from your Pinecone index.`);
}

main().catch((err) => {
  console.error("\n✗ Test failed:", err.message ?? err);
  process.exit(1);
});
