import { MergifyReporter } from "@mergifyio/vitest";
import {
  dedicatedToolVitestProjects,
  devServerTests,
  dontReviewItPreset,
  generatedFiles,
  lintOptions,
  rootNodeToolTestIncludes,
  rootOnDemandChecks,
  workerTests,
} from "@repo/dont-review-it";
import { lifecycle, taskInput } from "@repo/vite-config";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

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
      "check:types": {
        command: "dont-review-it-typecheck",
        input: [...taskInput],
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
      mutation: {
        cache: false,
        command: "stryker run tools/dont-review-it/src/repository/stryker.ts",
      },
      test: {
        command: `vp test run --project '!@repo/*' --exclude '${devServerTests}'`,
        input: [
          ...taskInput,
          "!coverage/**",
          { base: "workspace", pattern: "!**/coverage/**" },
          { base: "workspace", pattern: "pnpm-lock.yaml" },
          { base: "workspace", pattern: "pnpm-workspace.yaml" },
        ],
        output: [],
      },
      "test:dev-server": { cache: false, command: "vp test run --project dev-server" },
      "test:workers": {
        command: "vp test run --project workers",
        input: [
          ...taskInput,
          "!coverage/**",
          { base: "workspace", pattern: "!**/coverage/**" },
          { base: "workspace", pattern: "pnpm-lock.yaml" },
          { base: "workspace", pattern: "pnpm-workspace.yaml" },
        ],
        output: [],
      },
      ...lifecycle({
        prepush: ["knip", "check:canonical-literal-types"],
        premerge: ["test", "test:dev-server", "test:workers"],
        prerelease: ["mutation"],
      }),
      "check:repository": rootOnDemandChecks["check:repository"],
    },
  },
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
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
          exclude: [...defaultExclude, workerTests, devServerTests],
          include: [
            ...rootNodeToolTestIncludes,
            "tools/dont-review-it/src/repository/**/*.test.ts",
          ],
          name: "node",
        },
      },
      { extends: true, test: { include: [devServerTests], name: "dev-server" } },
      "./vitest.workers.config.ts",
      "./libs/ui/storybook/vitest.config.ts",
      ...dedicatedToolVitestProjects,
    ],
    mockReset: true,
    reporters: ["default", new MergifyReporter()],
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
