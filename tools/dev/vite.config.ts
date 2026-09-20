import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      authenticate: { cache: false, command: "node src/cli.ts authenticate" },
      browser: { cache: false, command: "node src/cli.ts browser" },
      "browser-command": { cache: false, command: "node src/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "node src/cli.ts ci-runner" },
      connect: { cache: false, command: "node src/cli.ts connect" },
      logs: { cache: false, command: "node src/cli.ts logs" },
      operator: { cache: false, command: "node src/cli.ts operator" },
      "prepare-browser": { cache: false, command: "node src/prepare-browser.ts" },
      observe: { cache: false, command: "node src/observe/cli.ts" },
      "check:exported": { cache: false, command: "node src/observe/receiver-check.ts" },
      symbolicate: { cache: false, command: "node src/observe/symbolicate.ts" },
      verify: { cache: false, command: "node src/observe/verify.ts" },
      setup: { cache: false, command: "node src/cli.ts setup" },
      start: { cache: false, command: "node src/cli.ts start" },
      status: { cache: false, command: "node src/cli.ts status" },
      stop: { cache: false, command: "node src/cli.ts stop" },
      storybook: { cache: false, command: "node src/cli.ts storybook" },
      ...lifecycle({
        precommit: [],
        prepush: ["check:effect"],
        prepr: [],
        premerge: [],
        prerelease: [],
      }),
    },
  },
});
