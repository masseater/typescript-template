import { effectDiagnostics, lifecycle } from "@repo/config/vite";
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
      ...lifecycle({ precommit: [], premerge: ["test:e2e"], prepush: ["check:effect"] }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/**/*.test.ts"],
    maxWorkers: 1,
    mockReset: true,
    pool: "forks",
    restoreMocks: true,
    testTimeout: 600_000,
  },
});
