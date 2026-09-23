import { effectDiagnostics, lifecycle, modularBoundaries } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...modularBoundaries,
      "db:bootstrap:local": { cache: false, command: "./src/features/db-local/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/features/db-local/migrate-local.ts" },
      ...lifecycle({ prepush: ["check:effect", "check:modular"] }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
