import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const errorMonitorVite = monitorWorkerVite();

export default defineConfig({
  ...errorMonitorVite,
  test: {
    ...errorMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
