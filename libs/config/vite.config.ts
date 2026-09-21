import { defineConfig } from "vite-plus";

const typecheckInput = [
  { auto: true },
  { base: "workspace", pattern: "!node_modules/.modules.yaml" },
  { base: "workspace", pattern: "!**/node_modules/.bin/**" },
  { base: "workspace", pattern: "**/*.{ts,tsx}" },
  { base: "workspace", pattern: "**/package.json" },
  { base: "workspace", pattern: "**/tsconfig*.json" },
  { base: "workspace", pattern: "**/effect-typecheck-baseline.json" },
  { base: "workspace", pattern: "!**/node_modules/**" },
  { base: "workspace", pattern: "!**/dist/**" },
  { base: "workspace", pattern: "!**/.paraglide/**" },
  { base: "workspace", pattern: "!**/.local/**" },
] as const;

export default defineConfig({
  run: {
    tasks: {
      "check:effect:gate": {
        command: "check-effect-typecheck",
        input: [...typecheckInput],
      },
      "check:effect": {
        command:
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
        dependsOn: ["check:effect:gate"],
        input: [...typecheckInput],
      },
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge"] },
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
