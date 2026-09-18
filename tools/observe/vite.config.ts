import { defineConfig } from "vite-plus";

import { effectDiagnostics, lifecycle } from "@repo/config/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "check:exported": { cache: false, command: "node src/receiver-check.ts" },
      ...lifecycle({ precommit: [], premerge: ["check:exported"], prepush: ["check:effect"] }),
    },
  },
});
