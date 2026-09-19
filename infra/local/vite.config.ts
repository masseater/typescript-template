import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      config: { cache: false, command: "node src/compose.ts config" },
      logs: { cache: false, command: "node src/compose.ts logs" },
      status: { cache: false, command: "node src/compose.ts status" },
      up: { cache: false, command: "node src/compose.ts up" },
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
