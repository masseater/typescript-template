import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/telemetry/optional-setting";
import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  taskInput,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
      onlyBundle: ["@better-auth/core", "better-call", "drizzle-orm", "effect", "msgpackr"],
    },
    entry: { index: "src/features/core/worker.ts" },
    format: "esm" as const,
    outExtensions: () => ({ js: ".js" }),
    platform: "browser" as const,
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["build"],
        premerge: [],
        prerelease: [],
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
