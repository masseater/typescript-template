import { defineConfig } from "vite-plus";

import { awaitingEffectRun } from "./src/vite.ts";

export default defineConfig({
  run: awaitingEffectRun,
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
