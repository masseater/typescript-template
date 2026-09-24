import { fileURLToPath } from "node:url";

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
import { telemetryAsked } from "@repo/telemetry/optional-setting";
import {
  effectDiagnostics,
  lifecycle,
  taskInput,
  workspaceParaglideCompile,
  telemetryEnv,
  testRun,
} from "@repo/vite-config";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const textModule = (code: string, moduleId: string): string | undefined =>
  textModulePattern.test(moduleId) ? `export default ${JSON.stringify(code)};` : undefined;

const rootOwnedPaths = [
  ".claude",
  ".cursor",
  ".fallowrc.json",
  ".fallowrc.production.json",
  ".gitattributes",
  ".github",
  ".gitignore",
  ".mcp.json",
  ".mergify.yml",
  ".textlint-ai-words.json",
  ".textlintrc.json",
  ".vite-hooks",
  "AGENTS.md",
  "CLAUDE.md",
  "DESIGN.md",
  "README.md",
  "docs",
  "mise.toml",
  "package.json",
  "patches",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "renovate.json",
  "tsconfig.base.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.mutation.config.ts",
  "vitest.workers.config.ts",
  "vitest.workers.main.ts",
] as const;

const nodeTestIncludes = [
  "libs/**/*.test.ts",
  "libs/**/*.test.tsx",
  "apps/**/*.test.ts",
  "apps/**/*.test.tsx",
  ...rootNodeToolTestIncludes,
  "tools/dont-review-it/src/features/dont-review-it/repository/**/*.test.ts",
  "infra/**/*.test.ts",
] as const;

export default defineConfig({
  fmt: dontReviewItPreset.fmt({
    ignorePatterns: [...generatedFiles],
    sortTailwindcss: {
      functions: ["cn", "cva"],
      stylesheet: "./libs/ui/src/features/ui/styles.css",
    },
  }),
  lint: dontReviewItPreset.lint(lintOptions),
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      "compile:paraglide": workspaceParaglideCompile,
      "check:code": {
        command: `vp check ${rootOwnedPaths.join(" ")}`,
        env: [...telemetryEnv],
        input: [...taskInput],
      },
      ...effectDiagnostics(import.meta.dirname),
      "check:types": {
        command: rootOnDemandChecks["check:types"],
        env: [...telemetryEnv],
        dependsOn: ["compile:paraglide"],
        input: [...taskInput],
      },
      "check:canonical-literal-types": {
        command: "dont-review-it-canonical-literal-types",
        env: [...telemetryEnv],
        dependsOn: ["compile:paraglide"],
        input: [...taskInput],
      },
      fallow: {
        command: ["fallow", "fallow dead-code --config .fallowrc.production.json"],
        env: [...telemetryEnv],
        dependsOn: ["compile:paraglide"],
        input: [...taskInput, "!.fallow/**"],
        output: [{ auto: true }, "!.fallow/**"],
      },
      mutation: {
        cache: false,
        command:
          "stryker run tools/dont-review-it/src/features/dont-review-it/repository/stryker-test-fixture.ts",
      },
      test: {
        ...testRun.test,
        command: `vp test run --project '!@repo/*' --exclude '${devServerTests}'`,
        dependsOn: ["compile:paraglide"],
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
        command: 'textlint "**/*.md"',
        env: [...telemetryEnv],
        input: [
          ...taskInput,
          { base: "workspace", pattern: "**/*.md" },
          { base: "workspace", pattern: ".textlint-ai-words.json" },
          { base: "workspace", pattern: ".textlintrc.json" },
        ],
      },
      ...lifecycle({
        precommit: ["check:text", "check:code"],
        prepush: ["check:effect", "fallow", "check:canonical-literal-types"],
        prepr: ["check:repository"],
        premerge: ["test:dev-server", "test:storybook"],
        prerelease: ["mutation"],
      }),
      "check:repository": { cache: false, command: "dont-review-it check-repository" },
    },
  },
  test: {
    experimental: {
      openTelemetry: {
        enabled: telemetryAsked,
        sdkPath: fileURLToPath(import.meta.resolve("@repo/telemetry/vitest-sdk")),
      },
    },
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
      "libs/config/src/features/config/worker.ts",
      "tools/dont-review-it/src/features/dont-review-it/repository/test-runtime.ts",
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
