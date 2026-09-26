import { telemetryMeasured } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
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
      config: { cache: false, command: "./src/features/local/compose.ts config" },
      logs: { cache: false, command: "./src/features/local/compose.ts logs" },
      status: { cache: false, command: "./src/features/local/compose.ts status" },
      up: { cache: false, command: "./src/features/local/compose.ts up" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryMeasured,
        sdkPath: sdkFilePath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
