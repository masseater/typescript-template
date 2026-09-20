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
    testTimeout: 15_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: [
      "src/cli.ts",
      "src/canonical-literal-types/run-as-task.ts",
      "src/index.ts",
      "src/plugin.ts",
      "src/vitest/standard-io-test.ts",
    ],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
