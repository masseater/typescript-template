import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "check:staged": { cache: false, command: "node check-staged.ts" },
      "clean:shared-task-cache": { cache: false, command: "node clean-shared-task-cache.ts" },
      ...lifecycle({
        precommit: ["check:staged"],
        prepush: ["check:effect"],
        prepr: [],
        premerge: [],
        prerelease: [],
      }),
    },
  },
});
