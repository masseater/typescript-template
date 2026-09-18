import { fileURLToPath } from "node:url";

import { effectDiagnostics, lifecycle, testRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...testRun,
      ...lifecycle({ precommit: [], premerge: ["test"], prepush: ["check:effect", "check"] }),
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
    entry: [
      "src/throttle/cli.ts",
      "src/spool/cli.ts",
      "src/unabridged/cli.ts",
      "src/telemetry/telemetry.ts",
      "src/telemetry/vitest-sdk.ts",
    ],
    dts: { generator: "tsgo" },
  },
});
