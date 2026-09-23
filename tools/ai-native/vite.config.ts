import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import {
  checkCode,
  effectDiagnostics,
  intentValidation,
  lifecycle,
  testRun,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      ...intentValidation,
      ...testRun,
      ...lifecycle({
        prepush: ["check:effect", "check:code", "check:imports", "check"],
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
      "src/throttle/cli.ts",
      "src/spool/cli.ts",
      "src/sync-base/cli.ts",
      "src/unabridged/cli.ts",
    ],
    dts: { generator: "tsgo" },
  },
});
