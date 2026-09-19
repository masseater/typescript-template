import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "check:staged": { cache: false, command: "node check-staged.ts" },
      ...lifecycle({ precommit: ["check:staged"], premerge: [], prepush: ["check:effect"] }),
    },
  },
});
