import {
  effectDiagnostics,
  effectTsgoNoEmit,
  lifecycle,
  modularBoundaries,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: [effectTsgoNoEmit("tsconfig.json"), effectTsgoNoEmit("scenarios/tsconfig.json")],
        input: effectDiagnostics["check:effect"].input,
      },
      ...modularBoundaries,
      ci: {
        cache: false,
        command: "./src/features/load/ci.ts",
        dependsOn: [
          "@repo/local#up",
          "@repo/dev#setup",
          "@repo/db-local#db:migrate:local",
          "@repo/service-member#build",
        ],
      },
      load: { cache: false, command: "./src/features/load/cli.ts" },
      ...lifecycle({ prepush: ["check:effect", "check:modular"] }),
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
