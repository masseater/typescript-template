import { applications, wikiWorker } from "@repo/config";
import { awaitingEffectRun, taskInput, telemetryEnv } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/features/cloudflare/monitors.ts";

const stackBuilds = ["core", wikiWorker, ...applications, ...monitorStacks].map(
  (unit) => `@repo/${unit}#build`,
);

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectRun(import.meta.dirname, {
        prepr: ["verify:stacks"],
        prerelease: ["verify:account"],
      }).tasks,
      "bootstrap:state": { cache: false, command: "./src/features/cloudflare/bootstrap-state.ts" },
      "db:bootstrap:remote": {
        cache: false,
        command: "./src/features/cloudflare/database-command.ts bootstrap",
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
      "materialize:env": { cache: false, command: "./src/features/cloudflare/materialize-env.ts" },
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
        env: [...telemetryEnv],
        dependsOn: stackBuilds,
        input: [...taskInput],
      },
    },
  },
});
