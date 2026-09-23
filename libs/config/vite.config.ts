import { defineConfig } from "vite-plus";

import { effectTsgoNoEmit, effectTypecheckInputs } from "./src/effect-typecheck.ts";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [...effectTypecheckInputs],
      },
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect"] },
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
