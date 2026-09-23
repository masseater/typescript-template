import { checkCode, modularBoundaries, workspaceCheckImports } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

import { effectTsgoNoEmit, effectTypecheckInputs } from "./src/features/config/effect-typecheck.ts";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [...effectTypecheckInputs],
      },
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      precommit: { command: [], dependsOn: ["check:code"] },
      prepush: {
        command: [],
        dependsOn: ["precommit", "check:effect", "check:imports", "check:modular"],
      },
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
