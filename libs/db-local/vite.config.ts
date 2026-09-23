import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/telemetry/optional-setting";
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
      ...effectDiagnostics(import.meta.dirname),
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
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
