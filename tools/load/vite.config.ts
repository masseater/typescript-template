import {
  effectDiagnostics,
  effectTsgoNoEmit,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  telemetryEnv,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics(import.meta.dirname),
      "check:effect:scenarios": {
        command: effectTsgoNoEmit("scenarios/tsconfig.json"),
        env: [...telemetryEnv],
        input: effectDiagnostics(import.meta.dirname)["check:effect"].input,
      },
      ...checkCode,
      ...workspaceCheckImports,
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
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:effect:scenarios", "check:imports", "check:modular"],
      }),
    },
  },
});
