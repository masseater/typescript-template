import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      config: { cache: false, command: "./src/features/local/compose.ts config" },
      logs: { cache: false, command: "./src/features/local/compose.ts logs" },
      status: { cache: false, command: "./src/features/local/compose.ts status" },
      up: { cache: false, command: "./src/features/local/compose.ts up" },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
