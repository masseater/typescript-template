import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      browser: { cache: false, command: "node src/cli.ts browser" },
      "browser-command": { cache: false, command: "node src/cli.ts browser-command" },
      "ci-runner": { cache: false, command: "node src/cli.ts ci-runner" },
      connect: { cache: false, command: "node src/cli.ts connect" },
      logs: { cache: false, command: "node src/cli.ts logs" },
      "prepare-browser": { cache: false, command: "node src/prepare-browser.ts" },
      setup: { cache: false, command: "node src/cli.ts setup" },
      start: { cache: false, command: "node src/cli.ts start" },
      status: { cache: false, command: "node src/cli.ts status" },
      stop: { cache: false, command: "node src/cli.ts stop" },
      storybook: { cache: false, command: "node src/cli.ts storybook" },
      ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect"] }),
    },
  },
});
