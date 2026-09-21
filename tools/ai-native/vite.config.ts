import { fileURLToPath } from "node:url";

import {
  checkCode,
  effectDiagnostics,
  intentValidation,
  lifecycle,
  testCoverageRun,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...intentValidation,
      ...checkCode,
      ...testCoverageRun,
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check"],
        prepr: [],
        premerge: ["test"],
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
    entry: ["src/throttle/cli.ts", "src/spool/cli.ts", "src/unabridged/cli.ts"],
    dts: { generator: "tsgo" },
  },
});
