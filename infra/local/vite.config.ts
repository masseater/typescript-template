import { effectDiagnostics, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      config: { cache: false, command: "./src/compose.ts config" },
      logs: { cache: false, command: "./src/compose.ts logs" },
      status: { cache: false, command: "./src/compose.ts status" },
      up: { cache: false, command: "./src/compose.ts up" },
      ...lifecycle({ prepush: ["check:effect"] }),
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
