import { monitorWorkerVite } from "@repo/monitor/vite";
import { vitestOpenTelemetry } from "@repo/telemetry/vitest-sdk-path";
import { defineConfig } from "vite-plus";

const healthMonitorVite = monitorWorkerVite(import.meta.dirname);

export default defineConfig({
  ...healthMonitorVite,
  test: {
    experimental: { openTelemetry: vitestOpenTelemetry },
    ...healthMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
