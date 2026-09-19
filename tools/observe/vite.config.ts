import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "check:exported": { cache: false, command: "./src/receiver-check.ts" },
      observe: { cache: false, command: "./src/cli.ts" },
      symbolicate: { cache: false, command: "./src/symbolicate.ts" },
      verify: { cache: false, command: "./src/verify.ts" },
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
