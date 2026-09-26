import { telemetryMeasured } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      deploy: { cache: false, command: "repo-github deploy wiki-publisher" },
      plan: { cache: false, command: "repo-github plan wiki-publisher" },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryMeasured,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
