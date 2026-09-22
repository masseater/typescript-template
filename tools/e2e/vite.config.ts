import { MergifyReporter } from "@mergifyio/vitest";
import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { roleApplications } from "./src/journey-roles.ts";

const applicationChecks = Object.values(roleApplications).flatMap((application) => [
  `@repo/${application}#build`,
  `@repo/${application}#check:dev`,
]);

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "test:e2e": {
        cache: false,
        command: "vp test run",
        dependsOn: ["@repo/dev#setup", ...applicationChecks],
      },
      verify: { cache: false, command: "./src/verify/cli.ts" },
      ...lifecycle({ prepush: ["check:effect"] }),
    },
  },
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/**/*.test.ts"],
    maxWorkers: 1,
    mockReset: true,
    pool: "forks",
    reporters: ["default", new MergifyReporter()],
    restoreMocks: true,
    testTimeout: 600_000,
  },
});
