import { effectRun } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: effectRun,
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
    testTimeout: 60_000,
  },
});
