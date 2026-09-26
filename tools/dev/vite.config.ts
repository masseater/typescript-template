import { awaitingEffectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectRun(import.meta.dirname, { premerge: ["check:exported"] }).tasks,
      authenticate: { cache: false, command: "./src/features/dev/cli.ts authenticate" },
      browser: { cache: false, command: "./src/features/dev/cli.ts browser" },
      "browser-command": { cache: false, command: "./src/features/dev/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "./src/features/dev/cli.ts ci-runner" },
      "db:bootstrap:local": { cache: false, command: "./src/features/dev/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/features/dev/migrate-local.ts" },
      connect: { cache: false, command: "./src/features/dev/cli.ts connect" },
      logs: { cache: false, command: "./src/features/dev/cli.ts logs" },
      operator: { cache: false, command: "./src/features/dev/cli.ts operator" },
      observe: { cache: false, command: "./src/features/dev/observe/cli.ts" },
      "check:exported": { cache: false, command: "./src/features/dev/observe/receiver-check.ts" },
      symbolicate: { cache: false, command: "./src/features/dev/observe/symbolicate.ts" },
      verify: { cache: false, command: "./src/features/dev/observe/verify.ts" },
      setup: { cache: false, command: "./src/features/dev/cli.ts setup" },
      start: { cache: false, command: "./src/features/dev/cli.ts start" },
      status: { cache: false, command: "./src/features/dev/cli.ts status" },
      stop: { cache: false, command: "./src/features/dev/cli.ts stop" },
      storybook: { cache: false, command: "./src/features/dev/cli.ts storybook" },
    },
  },
});
