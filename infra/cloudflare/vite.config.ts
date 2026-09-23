import { applications } from "@repo/config";
import { lifecycle, taskInput, testableLibraryRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/features/cloudflare/monitors.ts";

const stackBuilds = ["core", ...applications, ...monitorStacks].map(
  (unit) => `@repo/${unit}#build`,
);

export default defineConfig({
  run: {
    tasks: {
      ...testableLibraryRun.tasks,
      "bootstrap:state": { cache: false, command: "./src/features/cloudflare/bootstrap-state.ts" },
      "db:bootstrap:remote": {
        cache: false,
        command: "./src/features/cloudflare/database-command.ts bootstrap",
      },
      "db:migrate:remote": {
        cache: false,
        command: "./src/features/cloudflare/database-command.ts migrate",
      },
      deploy: {
        cache: false,
        command: "./src/features/cloudflare/cli.ts deploy",
        dependsOn: [...stackBuilds, "prerelease", "typescript-template#prerelease"],
      },
      "deploy:ordered": {
        cache: false,
        command: "./src/features/cloudflare/cli.ts deploy all",
        dependsOn: [...stackBuilds, "verify:account"],
      },
      "prepare:ci-env": { cache: false, command: "./src/features/cloudflare/prepare-ci-env.ts" },
      preview: {
        cache: false,
        command: "./src/features/cloudflare/cli.ts plan all",
        dependsOn: stackBuilds,
      },
      "verify:account": { cache: false, command: "./src/features/cloudflare/check-account.ts" },
      "probe:origins": { cache: false, command: "./src/features/cloudflare/verify-origins.ts" },
      "verify:stacks": {
        command: "./src/features/cloudflare/check-stacks.ts",
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["verify:stacks"],
        premerge: ["test"],
        prerelease: ["verify:account"],
      }),
    },
  },
  test: { testTimeout: 30_000 },
});
