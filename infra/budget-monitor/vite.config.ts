import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const worker = monitorWorkerVite("budget-monitor");

export default defineConfig({
  ...worker,
  run: {
    tasks: {
      ...worker.run.tasks,
      inspect: { cache: false, command: "./src/features/budget-monitor/inspect.ts" },
    },
  },
});
