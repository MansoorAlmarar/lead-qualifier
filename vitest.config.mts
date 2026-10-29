import { defineConfig } from "vitest/config";

// Only the eval tests. The frontend has its own Vitest config in frontend/.
export default defineConfig({
  test: { include: ["evals/**/*.test.ts"] },
});
