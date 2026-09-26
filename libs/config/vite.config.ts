import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { awaitingEffectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: awaitingEffectRun(import.meta.dirname),
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
    env: {
      TEMPLATE_LOCAL_DATABASE: ".local/d1-probe",
      TEMPLATE_PROCESS_ENVIRONMENT_CARRIED: "carried",
    },
    mockReset: true,
    restoreMocks: true,
  },
});
