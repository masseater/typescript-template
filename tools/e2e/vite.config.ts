import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

import { roleApplications } from "./src/journey-roles.ts";

const applicationChecks = Object.values(roleApplications).flatMap((application) => [
  `@repo/${application}#build`,
  `@repo/${application}#check:dev`,
]);

// oxlint-disable-next-line import/no-default-export
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
    fileParallelism: false,
    hookTimeout: 900_000,
    include: ["src/**/*.test.ts"],
    maxWorkers: 1,
    pool: "forks",
    testTimeout: 600_000,
  },
});
