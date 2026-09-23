import {
  awaitingEffectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      authenticate: { cache: false, command: "./src/features/dev/cli.ts authenticate" },
      browser: { cache: false, command: "./src/features/dev/cli.ts browser" },
      "browser-command": { cache: false, command: "./src/features/dev/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "./src/features/dev/cli.ts ci-runner" },
      connect: { cache: false, command: "./src/features/dev/cli.ts connect" },
      logs: { cache: false, command: "./src/features/dev/cli.ts logs" },
      operator: { cache: false, command: "./src/features/dev/cli.ts operator" },
      "prepare-browser": { cache: false, command: "./src/features/dev/prepare-browser.ts" },
      observe: { cache: false, command: "./src/features/dev/observe/cli.ts" },
      "check:exported": { cache: false, command: "./src/features/dev/observe/receiver-check.ts" },
      symbolicate: { cache: false, command: "./src/features/dev/observe/symbolicate.ts" },
      verify: { cache: false, command: "./src/features/dev/observe/verify.ts" },
      setup: { cache: false, command: "./src/features/dev/cli.ts setup" },
      start: { cache: false, command: "./src/features/dev/cli.ts start" },
      status: { cache: false, command: "./src/features/dev/cli.ts status" },
      stop: { cache: false, command: "./src/features/dev/cli.ts stop" },
      storybook: { cache: false, command: "./src/features/dev/cli.ts storybook" },
      ...lifecycle({
        premerge: ["check:exported"],
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
      }),
    },
  },
});
