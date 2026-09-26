import { applications, wikiWorker } from "@repo/config";
import {
  awaitingEffectDiagnostics,
  lifecycle,
  taskInput,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  telemetryEnv,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { monitorStacks } from "./src/features/cloudflare/monitors.ts";

const stackBuilds = ["core", wikiWorker, ...applications, ...monitorStacks].map(
  (unit) => `@repo/${unit}#build`,
);
const deploymentPrerequisites = [...stackBuilds, "verify:account"];

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      "bootstrap:state": { cache: false, command: "./src/features/cloudflare/bootstrap-state.ts" },
      "db:bootstrap:remote": {
        cache: false,
        command: "./src/features/cloudflare/database-command.ts bootstrap",
      },
      deploy: {
        cache: false,
        command: "./src/features/cloudflare/cli.ts deploy",
        dependsOn: deploymentPrerequisites,
      },
      "deploy:ordered": {
        cache: false,
        command: "./src/features/cloudflare/cli.ts deploy all",
        dependsOn: deploymentPrerequisites,
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
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["verify:stacks"],
        prerelease: ["verify:account"],
      }),
    },
  },
});
