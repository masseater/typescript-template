import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    include: ["src/journey.test.ts", "src/wiki.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
  },
});
