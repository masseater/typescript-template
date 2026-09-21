import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command:
          'sh -c \'out=$("$(effect-tsgo get-exe-path)" --noEmit -p tsconfig.json 2>&1 || :); printf "%s\\n" "$out"; printf "%s\\n" "$out" | grep -q "error TS2305" && exit 1; :\' && effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning',
        input: [
          { auto: true },
          { base: "workspace", pattern: "!node_modules/.modules.yaml" },
          { base: "workspace", pattern: "!**/node_modules/.bin/**" },
          { base: "workspace", pattern: "**/*.{ts,tsx}" },
          { base: "workspace", pattern: "**/package.json" },
          { base: "workspace", pattern: "**/tsconfig*.json" },
          { base: "workspace", pattern: "!**/node_modules/**" },
          { base: "workspace", pattern: "!**/dist/**" },
          { base: "workspace", pattern: "!**/.paraglide/**" },
          { base: "workspace", pattern: "!**/.local/**" },
        ],
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
