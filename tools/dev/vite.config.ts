import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      browser: { cache: false, command: "./src/cli.ts browser" },
      "browser-command": { cache: false, command: "./src/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "./src/cli.ts ci-runner" },
      connect: { cache: false, command: "./src/cli.ts connect" },
      logs: { cache: false, command: "./src/cli.ts logs" },
      "prepare-browser": { cache: false, command: "./src/prepare-browser.ts" },
      setup: { cache: false, command: "./src/cli.ts setup" },
      start: { cache: false, command: "./src/cli.ts start" },
      status: { cache: false, command: "./src/cli.ts status" },
      stop: { cache: false, command: "./src/cli.ts stop" },
      storybook: { cache: false, command: "./src/cli.ts storybook" },
      ...lifecycle({
        precommit: [],
        premerge: [],
        prepush: ["check:effect"],
        prepr: [],
        prerelease: [],
      }),
    },
  },
});
