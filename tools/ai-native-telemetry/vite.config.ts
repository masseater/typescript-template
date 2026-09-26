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
      "src/features/ai-native-telemetry/index.ts",
      "src/features/ai-native-telemetry/telemetry/optional-setting.ts",
      "src/features/ai-native-telemetry/telemetry/vitest-sdk.ts",
      "src/features/ai-native-telemetry/telemetry/vitest-sdk-path.ts",
    ],
    dts: { generator: "oxc" },
  },
});
