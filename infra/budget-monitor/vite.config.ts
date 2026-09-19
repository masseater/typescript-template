import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

const worker = monitorWorkerVite();

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  ...worker,
  run: {
    tasks: {
      ...worker.run.tasks,
      inspect: { cache: false, command: "./src/inspect.ts" },
    },
  },
});
