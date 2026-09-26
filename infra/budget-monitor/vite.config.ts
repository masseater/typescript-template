import { monitorWorkerVite } from "@repo/monitor/vite";
import { telemetryMeasured } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
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
        enabled: telemetryMeasured,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
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
