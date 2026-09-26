import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      deploy: { cache: false, command: "repo-github deploy wiki-publisher" },
      plan: { cache: false, command: "repo-github plan wiki-publisher" },
    },
  },
});
