import { MergifyReporter } from "@mergifyio/vitest";
import { vitestOpenTelemetry } from "@repo/telemetry/vitest-sdk-path";
import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { roleApplications } from "./src/features/e2e/journey-roles.ts";

const applicationChecks = Object.values(roleApplications).flatMap((application) => [
  `@repo/${application}#build`,
  `@repo/${application}#check:dev`,
]);

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      "test:e2e": {
        cache: false,
        command: "vp test run",
        dependsOn: ["@repo/dev#setup", ...applicationChecks],
      },
      verify: { cache: false, command: "./src/features/e2e/verify/cli.ts" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
      }),
    },
  },
  test: {
    experimental: { openTelemetry: vitestOpenTelemetry },
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/features/e2e/**/*.test.ts"],
    maxWorkers: 1,
    mockReset: true,
    pool: "forks",
    reporters: ["default", new MergifyReporter()],
    restoreMocks: true,
    testTimeout: 600_000,
  },
});
