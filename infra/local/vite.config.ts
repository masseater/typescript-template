import { checkCode, effectDiagnostics, lifecycle, workspaceCheckImports } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...checkCode,
      ...workspaceCheckImports,
      config: { cache: false, command: "./src/compose.ts config" },
      logs: { cache: false, command: "./src/compose.ts logs" },
      status: { cache: false, command: "./src/compose.ts status" },
      up: { cache: false, command: "./src/compose.ts up" },
      ...lifecycle({ precommit: ["check:code"], prepush: ["check:effect", "check:imports"] }),
    },
  },
});
