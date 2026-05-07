// Lint Cloud Functions without inheriting the Next.js root eslint.config.mjs
// (which uses ESLint 9 + eslint-config-next and breaks with this package's older TS-ESLint stack).
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["lib/**", "node_modules/**", "vitest.config.ts"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
);
