import { fileURLToPath } from "node:url";

import { monitorWorkerVite } from "@repo/monitor/vite";
import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { defineConfig } from "vite-plus";

const errorMonitorVite = monitorWorkerVite("error-monitor");

export default defineConfig({
  ...errorMonitorVite,
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    ...errorMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
