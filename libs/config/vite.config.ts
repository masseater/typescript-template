import { defineConfig } from "vite-plus";

import { effectTsgoNoEmit, effectTypecheckInputs } from "./src/effect-typecheck.ts";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command: effectTsgoNoEmit("tsconfig.json"),
        input: [...effectTypecheckInputs],
      },
      "check:code": {
        command: "vp check --no-error-on-unmatched-pattern",
        input: [
          { auto: true },
          { base: "workspace", pattern: "!node_modules/.modules.yaml" },
          { base: "workspace", pattern: "!**/node_modules/.bin/**" },
        ],
      },
      "check:imports": {
        command: "quality-check-imports",
        input: [
          { auto: true },
          { base: "workspace", pattern: "!node_modules/.modules.yaml" },
          { base: "workspace", pattern: "!**/node_modules/.bin/**" },
        ],
      },
      precommit: { command: [], dependsOn: [] },
      prepush: {
        command: [],
        dependsOn: ["precommit", "check:effect", "check:code", "check:imports"],
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
