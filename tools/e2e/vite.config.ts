import { MergifyReporter } from "@mergifyio/vitest";
import { telemetryAsked } from "@repo/telemetry/optional-setting";
import { sdkFilePath } from "@repo/telemetry/vitest-sdk-path";
import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { roleApplications } from "./src/features/e2e/journey-roles.ts";

const applicationChecks = Object.values(roleApplications).flatMap((application) => [
  `@repo/${application}#build`,
  `@repo/${application}#check:dev`,
]);

export default defineConfig({
  run: {
    tasks: {
      ...effectRun(import.meta.dirname).tasks,
      "test:e2e": {
        cache: false,
        command: "vp test run",
        dependsOn: ["@repo/dev#setup", ...applicationChecks],
      },
      verify: { cache: false, command: "./src/features/e2e/verify/cli.ts" },
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
