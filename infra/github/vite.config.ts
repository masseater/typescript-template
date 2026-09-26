import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      deploy: { cache: false, command: "./src/features/github/cli.ts deploy github" },
      plan: { cache: false, command: "./src/features/github/cli.ts plan github" },
    },
  },
});
