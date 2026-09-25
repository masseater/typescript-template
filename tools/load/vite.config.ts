import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import {
  effectDiagnostics,
  effectTsgoNoEmit,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  telemetryEnv,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      "check:effect:scenarios": {
        command: effectTsgoNoEmit("scenarios/tsconfig.json"),
        env: [...telemetryEnv],
        input: effectDiagnostics(import.meta.dirname)["check:effect"].input,
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
          "@repo/dev#db:migrate:local",
          "@repo/service-member#build",
        ],
      },
      load: { cache: false, command: "./src/features/load/cli.ts" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:effect:scenarios", "check:imports", "check:modular"],
      }),
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
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
