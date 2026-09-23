import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import {
  effectDiagnostics,
  intentValidation,
  lifecycle,
  testRun,
  modularBoundaries,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...modularBoundaries,
      ...intentValidation,
      ...testRun,
      "check:staged": {
        cache: false,
        command: "./src/features/dont-review-it/repository/check-staged.ts",
      },
      "pr-affected": {
        cache: false,
        command: "./src/features/dont-review-it/repository/pr-affected.ts",
      },
      "clean:shared-task-cache": {
        cache: false,
        command: "./src/features/dont-review-it/repository/clean-shared-task-cache.ts",
      },
      ...lifecycle({
        precommit: ["check:staged"],
        prepush: ["check:effect", "check", "check:modular"],
        prepr: ["test"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
      },
    },
    testTimeout: 60_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**", "src/features/dont-review-it/repository/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    exclude: ["**/node_modules/**", "**/dist/**", "src/features/dont-review-it/repository/**"],
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: [
      "src/features/dont-review-it/cli.ts",
      "src/features/dont-review-it/canonical-literal-types/run-as-task.ts",
      "src/features/dont-review-it/index.ts",
    ],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
