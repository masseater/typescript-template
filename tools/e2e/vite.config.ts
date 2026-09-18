import { defineConfig } from "vite-plus";

import { effectDiagnostics, lifecycle } from "@repo/config/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "test:e2e": { cache: false, command: "vp test run" },
      ...lifecycle({ precommit: [], premerge: ["test:e2e"], prepush: ["check:effect"] }),
    },
  },
  test: {
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/**/*.test.ts"],
    maxWorkers: 1,
    pool: "forks",
    testTimeout: 600_000,
  },
});
