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
      "bootstrap:state": { cache: false, command: "./src/bootstrap-state.ts" },
      "db:bootstrap:remote": { cache: false, command: "./src/database-command.ts bootstrap" },
      "db:migrate:remote": { cache: false, command: "./src/database-command.ts migrate" },
      deploy: {
        cache: false,
        command: "./src/cli.ts deploy",
        dependsOn: stackBuilds,
      },
      preview: {
        cache: false,
        command: "./src/cli.ts plan all",
        dependsOn: stackBuilds,
      },
      "verify:account": { cache: false, command: "./src/check-account.ts" },
      "verify:stacks": {
        command: "./src/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({
        precommit: [],
        prepush: ["check:effect"],
        prepr: [],
        premerge: ["verify:stacks"],
        prerelease: ["verify:account"],
      }),
    },
  },
});
