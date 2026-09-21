import { monitorWorkerVite } from "@repo/monitor/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  ...monitorWorkerVite(),
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
