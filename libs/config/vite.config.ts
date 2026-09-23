import { modularBoundaries } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { effectTsgoNoEmit, effectTypecheckInputs } from "./src/features/config/effect-typecheck.ts";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [...effectTypecheckInputs],
      },
      ...modularBoundaries,
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect", "check:modular"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge"] },
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
