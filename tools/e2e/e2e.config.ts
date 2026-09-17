import { defineConfig } from "vite-plus";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    fileParallelism: false,
    hookTimeout: 180_000,
    include: ["src/journey.test.ts", "src/wiki.test.ts"],
    maxWorkers: 1,
    retry: 0,
    testTimeout: 600_000,
  },
});
