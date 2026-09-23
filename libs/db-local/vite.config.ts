import { checkCode, effectDiagnostics, lifecycle, workspaceCheckImports } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      "db:bootstrap:local": { cache: false, command: "./src/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/migrate-local.ts" },
      ...lifecycle({ prepush: ["check:effect", "check:code", "check:imports"] }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
