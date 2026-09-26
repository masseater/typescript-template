import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { sdkFilePath } from "@repo/ai-native-telemetry/vitest-sdk-path";
import { effectRun, intentValidation, testRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname, { prepush: ["check"], prepr: ["test"] }).tasks,
      ...intentValidation,
      ...testRun,
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
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
