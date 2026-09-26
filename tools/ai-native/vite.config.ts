import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import { sdkFilePath } from "@repo/ai-native-telemetry/vitest-sdk-path";
import { toolRun, toolTest } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: toolRun(import.meta.dirname),
  test: {
    ...toolTest,
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
      },
    },
    pool: "threads",
    testTimeout: 60_000,
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
