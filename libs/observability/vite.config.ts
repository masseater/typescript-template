import { coveredTestableLibraryRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: coveredTestableLibraryRun,
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
