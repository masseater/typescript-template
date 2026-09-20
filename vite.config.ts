import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";
import { dontReviewItPreset } from "@repo/dont-review-it";
import { generatedFiles, lintOptions } from "@repo/quality/lint";
import { workerTests } from "@repo/quality/test-runtime";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { rootOnDemandChecks } from "./tools/quality/on-demand-checks.ts";

const importedTools = [
  "./tools/ai-native",
  "./tools/dont-review-it",
  "./tools/lint-rule-authoring",
  "./tools/repository-checks",
  "./tools/stop-ai-slop",
];

const changedSince = '"${TEST_CHANGED_SINCE:-origin/main}"';

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const textModule = (code: string, moduleId: string): string | undefined =>
  textModulePattern.test(moduleId) ? `export default ${JSON.stringify(code)};` : undefined;

export default defineConfig({
  fmt: dontReviewItPreset.fmt({
    ignorePatterns: [...generatedFiles],
    sortTailwindcss: { functions: ["cn", "cva"], stylesheet: "./libs/ui/src/styles.css" },
  }),
  ...(process.env.VITE_PLUS_SKIP_LINT_NATIVE === "1"
    ? {}
    : { lint: dontReviewItPreset.lint(lintOptions) }),
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      "check:client": {
        command: "node tools/quality/client-bundle.ts",
        input: [
          ...taskInput,
          "!**/dist/**",
          "!**/node_modules/.cache/**",
          { base: "workspace", pattern: "!.local" },
          { base: "workspace", pattern: "!.local/**" },
        ],
        output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
      },
      "check:code": { command: "vp check", input: [...taskInput] },
      ...effectDiagnostics,
      "check:imports":
        "depcruise --config tools/quality/dependency-cruiser.ts --output-type err-long apps libs infra tools",
      "check:react": {
        command: "node tools/quality/react-doctor.ts",
        input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**"],
        output: [{ auto: true }, "!**/node_modules/.cache/**"],
      },
      "check:canonical-literal-types": {
        command: "dont-review-it-canonical-literal-types",
        input: [...taskInput],
      },
      knip: {
        command: ["knip", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      mutation: { cache: false, command: "stryker run tools/quality/stryker.ts" },
      test: { cache: false, command: "vp test run --project '!@repo/*'" },
      "test:changed": {
        cache: false,
        command: [
          `git merge-base ${changedSince} HEAD > /dev/null`,
          `vp test run --project '!@repo/*' --changed ${changedSince} --passWithNoTests`,
        ],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect"],
        prepr: [
          "knip",
          "check:client",
          "check:imports",
          "check:react",
          "check:canonical-literal-types",
          "test:changed",
        ],
        premerge: ["test"],
        prerelease: ["mutation"],
      }),
      "check:repository": rootOnDemandChecks["check:repository"],
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    forceRerunTriggers: [
      "**/package.json",
      "**/tsconfig*.json",
      "pnpm-lock.yaml",
      "vite.config.ts",
      "tools/*/vite.config.ts",
      "**/vitest.config.*",
      "**/vitest.*.config.*",
      "libs/ui/storybook/**",
      "libs/db/migrations/**",
      "libs/config/src/worker.ts",
      "tools/quality/test-runtime.ts",
    ].map((pattern) => `${import.meta.dirname}/${pattern}`),
    projects: [
      {
        extends: true,
        test: {
          exclude: [...defaultExclude, workerTests],
          include: [
            "libs/**/*.test.ts",
            "libs/**/*.test.tsx",
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
            "tools/dev/**/*.test.ts",
            "tools/quality/**/*.test.ts",
            "tools/load/**/*.test.ts",
            "tools/observe/**/*.test.ts",
            "tools/commander/**/*.test.ts",
            "infra/**/*.test.ts",
          ],
          name: "node",
        },
      },
      "./vitest.workers.config.ts",
      "./libs/ui/storybook/vitest.config.ts",
      ...importedTools,
    ],
    mockReset: true,
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
