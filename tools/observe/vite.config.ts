import { effectRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectRun.tasks,
      "check:exported": { cache: false, command: "node src/receiver-check.ts" },
    },
  },
});
