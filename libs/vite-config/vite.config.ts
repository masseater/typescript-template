import { defineConfig } from "vite-plus";

import { effectRun } from "./src/features/vite-config/vite.ts";

export default defineConfig({
  run: effectRun,
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
