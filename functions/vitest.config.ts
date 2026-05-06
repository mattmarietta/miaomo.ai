import {defineConfig} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    // Provide stub env vars so modules don't throw on import during tests
    env: {
      PINECONE_API_KEY: "test-key",
      PINECONE_INDEX_NAME: "test-index",
      GOOGLE_API_KEY: "test-key",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/test-ingest.ts", "src/scripts/**"],
      reporter: ["text", "html"],
    },
  },
});
