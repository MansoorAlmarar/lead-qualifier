import { defineConfig } from "vitest/config";

// The eval and tools tests. The frontend has its own Vitest config in frontend/.
export default defineConfig({
  test: { include: ["evals/**/*.test.ts", "tools/**/*.test.ts"] },
});
