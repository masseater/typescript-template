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
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
