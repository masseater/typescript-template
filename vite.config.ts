import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";
import { dontReviewItPreset } from "@repo/dont-review-it";
import { generatedFiles, lintOptions } from "@repo/dont-review-it/lint";
import { workerTests } from "@repo/dont-review-it/test-runtime";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

const importedTools = [
  "./tools/ai-native",
  "./tools/dont-review-it",
  "./tools/lint-rule-authoring",
  "./tools/repository-checks",
  "./tools/stop-ai-slop",
];

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const textModule = (code: string, moduleId: string): string | undefined =>
  textModulePattern.test(moduleId) ? `export default ${JSON.stringify(code)};` : undefined;

export default defineConfig({
  fmt: dontReviewItPreset.fmt({
    ignorePatterns: [...generatedFiles],
    sortTailwindcss: { functions: ["cn", "cva"], stylesheet: "./libs/ui/src/styles.css" },
  }),
  lint: dontReviewItPreset.lint(lintOptions),
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      "check:client": {
        command: "node tools/dont-review-it/src/repository/client-bundle.ts",
        input: [...taskInput],
      },
      "check:code": { command: "vp check", input: [...taskInput] },
      ...effectDiagnostics,
      "check:imports":
        "depcruise --config tools/dont-review-it/src/repository/dependency-cruiser.ts --output-type err-long apps libs infra tools",
      "check:react": {
        command: "node tools/dont-review-it/src/repository/react-doctor.ts",
        input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**"],
        output: [{ auto: true }, "!**/node_modules/.cache/**"],
      },
      "check:repository": [
        "dont-review-it check",
        "lint-rule-authoring check",
        "stop-ai-slop check",
      ],
      "check:canonical-literal-types": {
        command: "dont-review-it-canonical-literal-types",
        input: [...taskInput],
      },
      knip: {
        command: ["knip", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      mutation: {
        cache: false,
        command: "stryker run tools/dont-review-it/src/repository/stryker.ts",
      },
      test: { cache: false, command: "vp test run --project '!@repo/*'" },
      ...lifecycle({
        precommit: ["check:code"],
        premerge: ["test"],
        prepush: [
          "knip",
          "check:client",
          "check:imports",
          "check:react",
          "check:effect",
          "check:canonical-literal-types",
        ],
      }),
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
      "tools/dont-review-it/src/repository/test-runtime.ts",
    ].map((pattern) => `${import.meta.dirname}/${pattern}`),
    projects: [
      {
        extends: true,
        test: {
          exclude: [...defaultExclude, workerTests],
          include: [
            "libs/**/*.test.ts",
            "apps/**/*.test.ts",
            "tools/dev/**/*.test.ts",
            "tools/dont-review-it/src/repository/**/*.test.ts",
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
