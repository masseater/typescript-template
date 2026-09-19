import { defineConfig } from "vite-plus";

const taskInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
  { base: "workspace", pattern: "!**/node_modules/.bin/**" },
] as const;

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command:
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
        input: [...taskInput],
      },
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: ["prepr"] },
      prerelease: { command: [], dependsOn: ["premerge"] },
    },
  },
});
