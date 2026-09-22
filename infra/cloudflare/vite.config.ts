import { applications } from "@repo/config";
import { awaitingEffectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/monitors.ts";

const stackBuilds = ["core", ...applications, ...monitorStacks].map(
  (unit) => `@repo/${unit}#build`,
);

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectDiagnostics,
      "bootstrap:state": { cache: false, command: "./src/bootstrap-state.ts" },
      "db:bootstrap:remote": { cache: false, command: "./src/database-command.ts bootstrap" },
      "db:migrate:remote": { cache: false, command: "./src/database-command.ts migrate" },
      deploy: {
        cache: false,
        command: "./src/cli.ts deploy",
        dependsOn: [...stackBuilds, "prerelease", "typescript-template#prerelease"],
      },
      "deploy:ordered": {
        cache: false,
        command: "./src/cli.ts deploy all",
        dependsOn: [...stackBuilds, "verify:account"],
      },
      "prepare:ci-env": { cache: false, command: "./src/prepare-ci-env.ts" },
      preview: {
        cache: false,
        command: "./src/cli.ts plan all",
        dependsOn: stackBuilds,
      },
      "verify:account": { cache: false, command: "./src/check-account.ts" },
      "probe:origins": { cache: false, command: "./src/verify-origins.ts" },
      "verify:stacks": {
        command: "./src/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({
        prepush: ["check:effect"],
        prepr: ["verify:stacks"],
        prerelease: ["verify:account"],
      }),
    },
  },
});
