import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";
import { dontReviewItPreset } from "@repo/dont-review-it";
import { generatedFiles, lintOptions } from "@repo/quality/lint";
import { devServerTests, workerTests } from "@repo/quality/test-runtime";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { rootOnDemandChecks } from "./tools/quality/on-demand-checks.ts";
import {
  dedicatedToolVitestProjects,
  rootNodeToolTestIncludes,
} from "./tools/quality/tool-test-projects.ts";

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
      test: {
        cache: false,
        command: `vp test run --project '!@repo/*' --exclude '${devServerTests}'`,
      },
      "test:dev-server": { cache: false, command: "vp test run --project dev-server" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: [
          "check:effect",
          "knip",
          "check:client",
          "check:imports",
          "check:react",
          "check:canonical-literal-types",
        ],
        prepr: ["test"],
        premerge: ["test:dev-server"],
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
          exclude: [...defaultExclude, workerTests, devServerTests],
          include: [
            "libs/**/*.test.ts",
            "libs/**/*.test.tsx",
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
            ...rootNodeToolTestIncludes,
            "infra/**/*.test.ts",
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
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
