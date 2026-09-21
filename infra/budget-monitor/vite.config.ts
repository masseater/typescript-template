import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const worker = monitorWorkerVite();

export default defineConfig({
  ...worker,
  run: {
    tasks: {
      ...worker.run.tasks,
      inspect: { cache: false, command: "./src/inspect.ts" },
    },
  },
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
