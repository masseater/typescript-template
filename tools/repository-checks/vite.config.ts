import { fileURLToPath } from "node:url";

import { effectDiagnostics, lifecycle, testRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...testRun,
      ...lifecycle({ precommit: [], premerge: ["test"], prepush: ["check:effect"] }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native/vitest-sdk")),
      },
    },
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
    entry: ["src/index.ts"],
    dts: { generator: "tsgo" },
  },
});
