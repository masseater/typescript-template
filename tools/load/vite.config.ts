import { effectDiagnostics, lifecycle, testCoverageRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...testCoverageRun,
      ci: {
        cache: false,
        command: "./src/ci.ts",
        dependsOn: [
          "@repo/local#up",
          "@repo/dev#setup",
          "@repo/db-local#db:migrate:local",
          "@repo/service-member#build",
        ],
      },
      load: { cache: false, command: "./src/cli.ts" },
      ...lifecycle({
        precommit: [],
        premerge: ["test"],
        prepush: ["check:effect"],
        prepr: [],
        prerelease: [],
      }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
