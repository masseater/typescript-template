import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { sdkFilePath } from "@repo/ai-native-telemetry/vitest-sdk-path";
import {
  effectDiagnostics,
  intentValidation,
  lifecycle,
  testRun,
  toolTest,
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
      "test:shared": {
        ...testRun.test,
        command: `vp test run --isolate=false --exclude '${isolatedNodeTests}'`,
      },
      "test:isolated": {
        ...testRun.test,
        command: `vp test run ${isolatedNodeTestSuffix}`,
      },
      test: { command: [], dependsOn: ["test:shared", "test:isolated"] },
      "hook:precommit": {
        cache: false,
        command: "dont-review-it-hook precommit",
      },
      "hook:prepush": {
        cache: false,
        command: "dont-review-it-hook prepush",
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
    ...toolTest,
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
      },
    },
    testTimeout: 60_000,
    coverage: {
      ...toolTest.coverage,
      exclude: [...toolTest.coverage.exclude, "src/features/dont-review-it/repository/**"],
    },
    exclude: ["**/node_modules/**", "**/dist/**", "src/features/dont-review-it/repository/**"],
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
