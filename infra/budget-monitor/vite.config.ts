import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const worker = monitorWorkerVite();

export default defineConfig({
  ...worker,
  run: {
    tasks: {
      ...worker.run.tasks,
      inspect: { cache: false, command: "node src/inspect.ts" },
    },
  },
});
