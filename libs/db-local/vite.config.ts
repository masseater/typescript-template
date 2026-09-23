import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "db:bootstrap:local": { cache: false, command: "./src/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/migrate-local.ts" },
      "db:schema-document": { cache: false, command: "./src/write-schema-document.ts" },
      ...lifecycle({ prepush: ["check:effect"] }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
