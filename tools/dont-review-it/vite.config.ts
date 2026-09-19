import { fileURLToPath } from "node:url";

import { effectDiagnostics, intentValidation, lifecycle, testRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...intentValidation,
      ...testRun,
      "check:staged": { cache: false, command: "node src/repository/check-staged.ts" },
      "clean:shared-task-cache": {
        cache: false,
        command: "node src/repository/clean-shared-task-cache.ts",
      },
      ...lifecycle({
        precommit: ["check:staged"],
        prepush: ["check:effect", "check"],
        prepr: ["test"],
        premerge: [],
        prerelease: [],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
      },
    },
    testTimeout: 60_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**", "src/repository/**"],
      thresholds: { 100: true, perFile: true },
    },
    exclude: ["**/node_modules/**", "**/dist/**", "src/repository/**"],
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: [
      "src/cli.ts",
      "src/canonical-literal-types/run-as-task.ts",
      "src/index.ts",
      "src/plugin.ts",
      "src/lint-rule-authoring/cli.ts",
      "src/lint-rule-authoring/index.ts",
      "src/lint-rule-authoring/plugin.ts",
      "src/repository-checks/index.ts",
      "src/stop-ai-slop/cli.ts",
      "src/vitest/standard-io-test.ts",
    ],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
