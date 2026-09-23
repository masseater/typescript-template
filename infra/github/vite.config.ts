import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectRun.tasks,
      deploy: { cache: false, command: "./src/features/github/cli.ts deploy" },
      plan: { cache: false, command: "./src/features/github/cli.ts plan" },
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
