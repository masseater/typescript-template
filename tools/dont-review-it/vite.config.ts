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
      "check:staged": { cache: false, command: "./src/repository/check-staged.ts" },
      "clean:shared-task-cache": {
        cache: false,
        command: "./src/repository/clean-shared-task-cache.ts",
      },
      ...lifecycle({
        precommit: ["check:staged", "check:code"],
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
    testTimeout: 60_000,
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
    entry: ["src/cli.ts", "src/canonical-literal-types/run-as-task.ts", "src/index.ts"],
    external: [/^vite-plus/],
    dts: { generator: "tsgo" },
  },
});
