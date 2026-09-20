import { fileURLToPath } from "node:url";

import { effectDiagnostics, intentValidation, lifecycle, testRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...intentValidation,
      ...testRun,
      ...lifecycle({
        precommit: [],
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
    mockReset: true,
    restoreMocks: true,
    pool: "threads",
    testTimeout: 60_000,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/telemetry/telemetry.ts", "src/telemetry/vitest-sdk.ts"],
    dts: { generator: "tsgo" },
  },
});
