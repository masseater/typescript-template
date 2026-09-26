import {
  awaitingEffectDiagnostics,
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
      ...awaitingEffectDiagnostics(import.meta.dirname),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      check: {
        command: "drizzle-kit check",
        env: [...telemetryEnv],
        input: [{ auto: true }, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      "db:generate": {
        cache: false,
        command: "drizzle-kit generate",
        dependsOn: ["@repo/db-local#db:schema-document"],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check", "check:modular"],
      }),
    },
  },
});
