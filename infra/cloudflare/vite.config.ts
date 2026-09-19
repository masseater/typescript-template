import { applications } from "@repo/config";
import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/monitors.ts";

const stackBuilds = [...applications, ...monitorStacks].map((unit) => `@repo/${unit}#build`);

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "bootstrap:state": { cache: false, command: "node src/bootstrap-state.ts" },
      "db:bootstrap:remote": { cache: false, command: "node src/database-command.ts bootstrap" },
      "db:migrate:remote": { cache: false, command: "node src/database-command.ts migrate" },
      deploy: {
        cache: false,
        command: "node src/cli.ts deploy",
        dependsOn: stackBuilds,
      },
      "deploy:ordered": {
        cache: false,
        command: "node src/cli.ts deploy all",
        dependsOn: stackBuilds,
      },
      "prepare:ci-env": { cache: false, command: "node src/prepare-ci-env.ts" },
      preview: {
        cache: false,
        command: "node src/cli.ts plan all",
        dependsOn: stackBuilds,
      },
      "verify:account": { cache: false, command: "node src/check-account.ts" },
      "verify:origins": { cache: false, command: "node src/verify-origins.ts" },
      "verify:stacks": {
        command: "node src/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({ precommit: [], premerge: ["verify:stacks"], prepush: ["check:effect"] }),
    },
  },
});
