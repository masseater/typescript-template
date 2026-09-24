import { monitorWorkerVite } from "@repo/monitor/vite";
import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { vitestSdkPath } from "@repo/telemetry/vitest-sdk-path";
import { defineConfig } from "vite-plus";

const budgetMonitorVite = monitorWorkerVite(import.meta.dirname);

export default defineConfig({
  ...budgetMonitorVite,
  run: {
    tasks: {
      ...budgetMonitorVite.run.tasks,
      inspect: { cache: false, command: "./src/features/budget-monitor/inspect.ts" },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: vitestSdkPath,
      },
    },
    ...budgetMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
