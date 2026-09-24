import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { vitestSdkPath } from "@repo/ai-native-telemetry/vitest-sdk-path";
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
        sdkPath: vitestSdkPath,
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
      "src/features/ai-native/throttle/cli.ts",
      "src/features/ai-native/spool/cli.ts",
      "src/features/ai-native/sync-base/cli.ts",
      "src/features/ai-native/unabridged/cli.ts",
      "src/features/ai-native/worktree-home/cli.ts",
    ],
    dts: { generator: "tsgo" },
  },
});
