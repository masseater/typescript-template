import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      deploy: { cache: false, command: "./src/features/github/cli.ts deploy github" },
      "migrate:state": {
        cache: false,
        command: "./src/features/github/cli.ts migrate-state github",
      },
      plan: { cache: false, command: "./src/features/github/cli.ts plan github" },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
