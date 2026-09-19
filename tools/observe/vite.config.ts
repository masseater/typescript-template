import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "check:exported": { cache: false, command: "node src/receiver-check.ts" },
      observe: { cache: false, command: "node src/cli.ts" },
      symbolicate: { cache: false, command: "node src/symbolicate.ts" },
      verify: { cache: false, command: "node src/verify.ts" },
      ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect"] }),
    },
  },
});
