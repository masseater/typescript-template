import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "ci-runner": { cache: false, command: "node src/cli.ts ci-runner" },
      ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect"] }),
    },
  },
});
