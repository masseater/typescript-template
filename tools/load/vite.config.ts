import { effectDiagnostics, effectTsgoNoEmit, lifecycle, testRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: [effectTsgoNoEmit("tsconfig.json"), effectTsgoNoEmit("scenarios/tsconfig.json")],
        input: effectDiagnostics["check:effect"].input,
      },
      ...testRun,
      ci: {
        cache: false,
        command: "./src/ci.ts",
        dependsOn: [
          "@repo/local#up",
          "@repo/dev#setup",
          "@repo/db-local#db:migrate:local",
          "@repo/service-member#build",
        ],
      },
      load: { cache: false, command: "./src/cli.ts" },
      ...lifecycle({
        prepush: ["check:effect"],
        premerge: ["test"],
      }),
    },
  },
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
