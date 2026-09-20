import { effectDiagnostics, lifecycle } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      check: {
        command: "drizzle-kit check",
        dependsOn: ["typescript-template#precommit"],
        input: [{ auto: true }, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      "db:bootstrap:local": { cache: false, command: "./src/bootstrap-local.ts" },
      "db:migrate:local": { cache: false, command: "./src/migrate-local.ts" },
      ...lifecycle({
        precommit: [],
        premerge: [],
        prepush: ["check:effect", "check"],
        prepr: [],
        prerelease: [],
      }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
