import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { vitestSdkPath } from "@repo/ai-native-telemetry/vitest-sdk-path";
import {
  effectDiagnostics,
  intentValidation,
  lifecycle,
  testRun,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import {
  isolatedNodeTestSuffix,
  isolatedNodeTests,
} from "./src/features/dont-review-it/repository/test-runtime.ts";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      ...intentValidation,
      test: {
        ...testRun.test,
        command: [
          `vp test run --isolate=false --exclude '${isolatedNodeTests}'`,
          `vp test run ${isolatedNodeTestSuffix}`,
        ],
      },
      "check:staged": {
        cache: false,
        command: "dont-review-it-check-staged",
      },
      "pr-affected": {
        cache: false,
        command: "dont-review-it-pr-affected",
      },
      "can-not-now": {
        cache: false,
        command: "dont-review-it-can-not-now",
      },
      "clean:shared-task-cache": {
        cache: false,
        command: "dont-review-it-clean-shared-task-cache",
      },
      ...lifecycle({
        precommit: ["check:staged", "check:code"],
        prepush: ["check:effect", "check:imports", "check", "check:modular"],
        prepr: ["test"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: vitestSdkPath,
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
