import { effectDiagnostics, lifecycle, modularBoundaries } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      ...modularBoundaries,
      config: { cache: false, command: "./src/features/local/compose.ts config" },
      logs: { cache: false, command: "./src/features/local/compose.ts logs" },
      status: { cache: false, command: "./src/features/local/compose.ts status" },
      up: { cache: false, command: "./src/features/local/compose.ts up" },
      ...lifecycle({ prepush: ["check:effect", "check:modular"] }),
    },
  },
});
