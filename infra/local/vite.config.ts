import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      config: { cache: false, command: "./src/compose.ts config" },
      logs: { cache: false, command: "./src/compose.ts logs" },
      status: { cache: false, command: "./src/compose.ts status" },
      up: { cache: false, command: "./src/compose.ts up" },
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
