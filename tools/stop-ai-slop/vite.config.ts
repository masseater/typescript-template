import { fileURLToPath } from "node:url";

import { effectRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: effectRun,
  test: {
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native/vitest-sdk")),
      },
    },
    mockReset: true,
    restoreMocks: true,
    testTimeout: 60_000,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { 100: true, perFile: true },
    },
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/cli.ts"],
    dts: { generator: "tsgo" },
  },
});
