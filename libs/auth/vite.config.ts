import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: effectRun,
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
