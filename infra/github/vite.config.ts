import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      "deploy:ci": { cache: false, command: "./src/features/github/cli.ts apply github" },
      plan: { cache: false, command: "./src/features/github/cli.ts plan github" },
      "require:removal-approval": {
        cache: false,
        command: "./src/features/github/verify-removal-approval.ts",
      },
    },
  },
});
