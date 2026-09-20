import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command:
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
        input: [{ auto: true }],
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
