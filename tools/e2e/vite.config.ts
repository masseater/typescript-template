import { fileURLToPath } from "node:url";

import { MergifyReporter } from "@mergifyio/vitest";
import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      "test:e2e": {
        cache: false,
        command: "vp test run",
        dependsOn: ["@repo/dev#setup"],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
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
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/features/e2e/**/*.test.ts"],
    maxWorkers: 1,
    mockReset: true,
    pool: "forks",
    reporters: ["default", new MergifyReporter()],
    restoreMocks: true,
    testTimeout: 600_000,
  },
});
