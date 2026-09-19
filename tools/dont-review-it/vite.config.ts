import { fileURLToPath } from "node:url";

import { effectDiagnostics, intentValidation, lifecycle, testRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...intentValidation,
      ...testRun,
      "check:staged": { cache: false, command: "node src/repository/check-staged.ts" },
      ...lifecycle({
        precommit: ["check:staged"],
        premerge: ["test"],
        prepush: ["check:effect", "check"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: process.env.MST_TELEMETRY !== undefined,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native/vitest-sdk")),
      },
    },
    testTimeout: 15_000,
    mockReset: true,
    restoreMocks: true,
    coverage: {
      exclude: ["specs/**", "src/repository/**"],
      thresholds: { 100: true, perFile: true },
    },
    exclude: ["**/node_modules/**", "**/dist/**", "src/repository/**"],
    unstubEnvs: true,
    unstubGlobals: true,
  },
  pack: {
    entry: ["src/cli.ts", "src/index.ts", "src/plugin.ts", "src/vitest/standard-io-test.ts"],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
