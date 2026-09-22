import { MergifyReporter } from "@mergifyio/vitest";
import {
  dedicatedToolVitestProjects,
  devServerTests,
  dontReviewItPreset,
  generatedFiles,
  isolatedNodeTests,
  lintOptions,
  rootNodeToolTestIncludes,
  rootOnDemandChecks,
  workerTests,
} from "@repo/dont-review-it";
import {
  effectDiagnostics,
  lifecycle,
  taskInput,
  workspaceParaglideCompile,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const textModule = (code: string, moduleId: string): string | undefined =>
  textModulePattern.test(moduleId) ? `export default ${JSON.stringify(code)};` : undefined;

const nodeTestIncludes = [
  "libs/**/*.test.ts",
  "libs/**/*.test.tsx",
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  ...rootNodeToolTestIncludes,
  "tools/dont-review-it/src/repository/**/*.test.ts",
  "infra/**/*.test.ts",
] as const;

export default defineConfig({
  fmt: dontReviewItPreset.fmt({
    ignorePatterns: [...generatedFiles],
    sortTailwindcss: { functions: ["cn", "cva"], stylesheet: "./libs/ui/src/styles.css" },
  }),
  lint: dontReviewItPreset.lint(lintOptions),
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      "compile:paraglide": workspaceParaglideCompile,
      "check:client": {
        command: "quality-check-client",
        dependsOn: ["compile:paraglide"],
        input: [
          ...taskInput,
          "!**/dist/**",
          "!**/node_modules/.cache/**",
          { base: "workspace", pattern: "!.local" },
          { base: "workspace", pattern: "!.local/**" },
        ],
        output: [{ auto: true }, { base: "workspace", pattern: ".local/source-maps/**" }],
      },
      "check:code": {
        command: "vp check",
        dependsOn: ["compile:paraglide"],
        input: [...taskInput],
      },
      ...effectDiagnostics,
      "check:types": {
        command: "dont-review-it-typecheck",
        dependsOn: ["compile:paraglide"],
        input: [...taskInput],
      },
      "check:imports": {
        command:
          "depcruise --config tools/dont-review-it/dependency-cruiser.ts --output-type err-long apps libs infra tools",
        dependsOn: ["compile:paraglide"],
      },
      "check:react": {
        command: "quality-check-react",
        dependsOn: ["compile:paraglide"],
        input: [...taskInput, "!**/node_modules/.cache/**", "!**/dist/**"],
        output: [{ auto: true }, "!**/node_modules/.cache/**"],
      },
      "check:canonical-literal-types": {
        command: "dont-review-it-canonical-literal-types",
        input: [...taskInput],
      },
      knip: {
        command: ["knip", "knip --strict"],
        dependsOn: ["compile:paraglide"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      mutation: {
        cache: false,
        command: "stryker run tools/dont-review-it/src/repository/stryker.ts",
      },
      test: {
        command: `vp test run --project '!@repo/*' --exclude '${devServerTests}'`,
        dependsOn: ["compile:paraglide"],
        input: [
          ...taskInput,
          "!coverage/**",
          { base: "workspace", pattern: "!**/coverage/**" },
          { base: "workspace", pattern: "pnpm-lock.yaml" },
          { base: "workspace", pattern: "pnpm-workspace.yaml" },
        ],
        output: [],
      },
      "test:dev-server": {
        cache: false,
        command: "vp test run --passWithNoTests --project dev-server",
        dependsOn: ["compile:paraglide"],
      },
      "test:storybook": {
        cache: false,
        command: "vp test run --project storybook",
        dependsOn: ["compile:paraglide"],
      },
      "check:text": {
        command: 'textlint "apps/internal-dashboard/content/docs/**/*.md"',
        input: [
          ...taskInput,
          { base: "workspace", pattern: "apps/internal-dashboard/content/docs/**/*.md" },
          { base: "workspace", pattern: ".textlintrc.json" },
        ],
      },
      ...lifecycle({
        precommit: ["check:text"],
        prepush: [
          "check:code",
          "check:effect",
          "knip",
          "check:client",
          "check:imports",
          "check:react",
          "check:canonical-literal-types",
        ],
        prepr: ["check:imports"],
        premerge: ["test:dev-server", "test:storybook"],
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
          exclude: [...defaultExclude, workerTests, devServerTests, isolatedNodeTests],
          include: [...nodeTestIncludes],
          isolate: false,
          name: "node",
        },
      },
      {
        extends: true,
        test: {
          exclude: [...defaultExclude, workerTests, devServerTests],
          include: nodeTestIncludes.map((pattern) =>
            pattern.replace("/**/*.test.", "/**/*.isolated.test."),
          ),
          name: "node-isolated",
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
