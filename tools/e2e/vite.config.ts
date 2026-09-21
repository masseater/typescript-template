import { MergifyReporter } from "@mergifyio/vitest";
import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "test:e2e": {
        cache: false,
        command: "vp test run",
        dependsOn: ["@repo/dev#setup"],
      },
      ...lifecycle({
        precommit: [],
        premerge: [],
        prepush: ["check:effect"],
        prepr: [],
        prerelease: [],
      }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/**/*.test.ts"],
    maxWorkers: 1,
    mockReset: true,
    pool: "forks",
    reporters: ["default", new MergifyReporter()],
    restoreMocks: true,
    testTimeout: 600_000,
  },
});
