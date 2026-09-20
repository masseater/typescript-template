import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      "db:bootstrap:local": { cache: false, command: "./src/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/migrate-local.ts" },
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
