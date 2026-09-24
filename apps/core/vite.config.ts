import { vitestOpenTelemetry } from "@repo/telemetry/vitest-sdk-path";
import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  taskInput,
  telemetryEnv,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
      onlyBundle: [
        "@better-auth/core",
        "better-call",
        "drizzle-orm",
        "effect",
        "es-toolkit",
        "msgpackr",
      ],
    },
    entry: { index: "src/features/core/worker.ts" },
    format: "esm" as const,
    outExtensions: () => ({ js: ".js" }),
    platform: "browser" as const,
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      build: {
        command: "vp pack",
        dependsOn: ["check:effect"],
        input: [...taskInput],
        env: [...telemetryEnv],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["build"],
      }),
    },
  },
  test: {
    experimental: { openTelemetry: vitestOpenTelemetry },
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
