import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      "db:bootstrap:local": { cache: false, command: "./src/features/db-local/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/features/db-local/migrate-local.ts" },
      "db:schema-document": {
        cache: false,
        command: "./src/features/db-local/write-schema-document.ts",
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
      }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
