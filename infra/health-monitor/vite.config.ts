import { monitorWorkerVite } from "@repo/monitor/vite";
import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { defineConfig } from "vite-plus";

const healthMonitorVite = monitorWorkerVite(import.meta.dirname);

export default defineConfig({
  ...healthMonitorVite,
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    ...healthMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
