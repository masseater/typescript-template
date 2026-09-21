import { awaitingEffectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...awaitingEffectDiagnostics,
      authenticate: { cache: false, command: "./src/cli.ts authenticate" },
      browser: { cache: false, command: "./src/cli.ts browser" },
      "browser-command": { cache: false, command: "./src/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "./src/cli.ts ci-runner" },
      connect: { cache: false, command: "./src/cli.ts connect" },
      logs: { cache: false, command: "./src/cli.ts logs" },
      operator: { cache: false, command: "./src/cli.ts operator" },
      "prepare-browser": { cache: false, command: "./src/prepare-browser.ts" },
      observe: { cache: false, command: "./src/observe/cli.ts" },
      "check:exported": { cache: false, command: "./src/observe/receiver-check.ts" },
      symbolicate: { cache: false, command: "./src/observe/symbolicate.ts" },
      verify: { cache: false, command: "./src/observe/verify.ts" },
      setup: { cache: false, command: "./src/cli.ts setup" },
      start: { cache: false, command: "./src/cli.ts start" },
      status: { cache: false, command: "./src/cli.ts status" },
      stop: { cache: false, command: "./src/cli.ts stop" },
      storybook: { cache: false, command: "./src/cli.ts storybook" },
      ...lifecycle({
        premerge: ["check:exported"],
        prepush: ["check:effect"],
      }),
    },
  },
});
