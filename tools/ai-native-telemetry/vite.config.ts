import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
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

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      ...intentValidation,
      ...testRun,
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check", "check:modular"],
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
    mockReset: true,
    restoreMocks: true,
    pool: "threads",
    testTimeout: 60_000,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: [
      "src/features/ai-native-telemetry/telemetry/optional-setting.ts",
      "src/features/ai-native-telemetry/telemetry/telemetry.ts",
      "src/features/ai-native-telemetry/telemetry/vitest-sdk.ts",
    ],
    dts: { generator: "tsgo" },
  },
});
