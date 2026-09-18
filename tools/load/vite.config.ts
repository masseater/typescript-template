import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      load: { cache: false, command: "node src/cli.ts" },
      ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect"] }),
    },
  },
});
