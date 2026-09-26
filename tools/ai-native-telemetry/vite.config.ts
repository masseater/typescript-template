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
      "src/features/ai-native-telemetry/index.ts",
      "src/features/ai-native-telemetry/telemetry/optional-setting.ts",
      "src/features/ai-native-telemetry/telemetry/vitest-sdk.ts",
      "src/features/ai-native-telemetry/telemetry/vitest-sdk-path.ts",
    ],
    dts: { generator: "oxc" },
  },
});
