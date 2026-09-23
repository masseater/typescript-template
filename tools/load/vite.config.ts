import { fileURLToPath } from "node:url";

import { telemetryAsked } from "@repo/ai-native-telemetry/optional-setting";
import {
  effectDiagnostics,
  effectTsgoNoEmit,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: [effectTsgoNoEmit("tsconfig.json"), effectTsgoNoEmit("scenarios/tsconfig.json")],
        input: effectDiagnostics["check:effect"].input,
      },
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      ci: {
        cache: false,
        command: "./src/features/load/ci.ts",
        dependsOn: [
          "@repo/local#up",
          "@repo/dev#setup",
          "@repo/db-local#db:migrate:local",
          "@repo/service-member#build",
        ],
      },
      load: { cache: false, command: "./src/features/load/cli.ts" },
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
        sdkPath: fileURLToPath(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk")),
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
