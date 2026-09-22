import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const budgetMonitorVite = monitorWorkerVite();

export default defineConfig({
  ...budgetMonitorVite,
  run: {
    tasks: {
      ...budgetMonitorVite.run.tasks,
      inspect: { cache: false, command: "./src/inspect.ts" },
    },
  },
  test: {
    ...budgetMonitorVite.test,
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
