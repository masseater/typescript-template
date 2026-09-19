import { effectDiagnostics, lifecycle } from "@repo/config/vite";
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
