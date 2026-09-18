import { applications } from "@template/config";
import { taskInput } from "@template/config/vite";
import { dontReviewItPreset } from "@template/dont-review-it";
import { LINT_SEVERITY } from "@template/lint-rule-authoring";
import { defineConfig } from "vite-plus";
import { defaultExclude } from "vite-plus/test/config";

import { workerTests } from "./tools/quality/test-runtime.ts";

const textModulePattern = /\.ya?ml$|\/\.vite-hooks\/[^/]+$/u;

const textModule = (code: string, id: string): string | undefined =>
  textModulePattern.test(id) ? `export default ${JSON.stringify(code)};` : undefined;

const generatedFiles = ["**/mockServiceWorker.js", "**/routeTree.gen.ts"];

export default defineConfig({
  fmt: dontReviewItPreset.fmt({ ignorePatterns: generatedFiles }),
  lint: dontReviewItPreset.lint({
    bundles: "all",
    ignorePatterns: generatedFiles,
    jsPlugins: [
      "./tools/quality/rules.ts",
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      "@shadcn/lint",
    ],
    options: { denyWarnings: true, typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["**/*.ts", "**/*.tsx"],
        plugins: ["react"],
        rules: {
          "react/exhaustive-deps": LINT_SEVERITY.ERROR,
          "react/forbid-component-props": LINT_SEVERITY.ERROR,
          "react/jsx-filename-extension": [LINT_SEVERITY.ERROR, { extensions: [".tsx"] }],
          "react/jsx-props-no-spreading": LINT_SEVERITY.ERROR,
          "react/only-export-components": [LINT_SEVERITY.ERROR, { allowExportNames: ["Route"] }],
          "react/rules-of-hooks": LINT_SEVERITY.ERROR,
        },
      },
      {
        files: ["libs/ui/src/shared/ui/**"],
        rules: {
          "react/forbid-component-props": [LINT_SEVERITY.ERROR, { forbid: ["style"] }],
          "shadcn/no-restyle": LINT_SEVERITY.OFF,
        },
      },
      {
        files: ["tools/ai-native/**", "tools/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
        },
      },
      {
        files: ["tools/dont-review-it/src/lint/oxlint/**"],
        rules: {
          "typescript/switch-exhaustiveness-check": [
            LINT_SEVERITY.ERROR,
            { considerDefaultExhaustiveForUnions: true },
          ],
        },
      },
      {
        files: ["**/{test,tests,__tests__,spec,__specs__}/**"],
        rules: {
          "vitest/consistent-test-filename": [
            LINT_SEVERITY.ERROR,
            { pattern: "place-the-test-file-next-to-its-source-instead-of-a-test-directory" },
          ],
        },
      },
    ],
    rules: {
      "dont-review-it/no-array-mutation--derive-new-array": LINT_SEVERITY.ERROR,
      "dont-review-it/no-blanket-suppression--name-and-record": LINT_SEVERITY.ERROR,
      "dont-review-it/no-class-as-mutable-cell--decide-in-an-iife": LINT_SEVERITY.ERROR,
      "dont-review-it/no-default-export--use-named-export": [
        LINT_SEVERITY.ERROR,
        {
          toolRequiredFileNames: [
            "drizzle.config.ts",
            "knip.ts",
            "main.ts",
            "monitor-fixture.ts",
            "preview.tsx",
            "server.ts",
            "steiger.config.js",
            "vite.config.ts",
            "vitest-sdk.ts",
            "vitest.config.ts",
            "vitest.workers.config.ts",
            "worker.ts",
          ],
        },
      ],
      "dont-review-it/no-detached-test-file--move-beside-source": [
        LINT_SEVERITY.ERROR,
        {
          testFileSuffixes: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".worker.test.ts"],
        },
      ],
      "dont-review-it/no-empty-catch--throw-or-handle": LINT_SEVERITY.ERROR,
      "dont-review-it/no-floating-promise--await-the-result": LINT_SEVERITY.ERROR,
      "dont-review-it/no-non-boundary-double--replace-at-the-external-boundary": [
        LINT_SEVERITY.ERROR,
        {
          externalIoPackages: [
            "@template/ai-native/telemetry",
            "@opentelemetry/exporter-logs-otlp-http",
            "@opentelemetry/exporter-metrics-otlp-http",
            "@opentelemetry/exporter-trace-otlp-http",
          ],
        },
      ],
      "dont-review-it/no-partial-rule-set--enable-the-whole-set": LINT_SEVERITY.ERROR,
      "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.ERROR,
      "dont-review-it/no-reassign--use-spread-or-iife": [
        LINT_SEVERITY.ERROR,
        {
          assignOnlyTargets: [
            "RuleTester.describe",
            "RuleTester.it",
            "RuleTester.itOnly",
            "globalThis.fetch",
          ],
        },
      ],
      "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.ERROR,
      "dont-review-it/no-silent-catch--rethrow-or-handle": LINT_SEVERITY.ERROR,
      "import/no-cycle": LINT_SEVERITY.ERROR,
      "no-restricted-imports": [
        LINT_SEVERITY.ERROR,
        {
          paths: [
            {
              message: "@template/ui の shadcn/ui (Base UI) 部品を使ってください。",
              name: "smarthr-ui",
            },
            {
              message: "Tailwind CSS v4 のユーティリティを使ってください。",
              name: "styled-components",
            },
            { message: "Paraglide JS を使ってください。", name: "react-intl" },
          ],
        },
      ],
      "project/boundaries": LINT_SEVERITY.ERROR,
      "project/effect-failures": LINT_SEVERITY.ERROR,
      "project/effect-stack": LINT_SEVERITY.ERROR,
      "project/environment-boundary": LINT_SEVERITY.ERROR,
      "project/layers": LINT_SEVERITY.ERROR,
      "project/no-manual-memoization": LINT_SEVERITY.ERROR,
      "project/test-runtime": LINT_SEVERITY.ERROR,
      "project/worker-fetch": LINT_SEVERITY.ERROR,
      "shadcn/no-arbitrary-values": LINT_SEVERITY.ERROR,
      "shadcn/no-raw-colors": LINT_SEVERITY.ERROR,
      "shadcn/no-restyle": [LINT_SEVERITY.ERROR, { allow: ["layout", "spacing"] }],
      "shadcn/no-unknown-classes": LINT_SEVERITY.ERROR,
      "typescript/only-throw-error": [
        LINT_SEVERITY.ERROR,
        {
          allow: [
            { from: "package", name: "NotFoundError", package: "@tanstack/router-core" },
            { from: "package", name: "Redirect", package: "@tanstack/router-core" },
          ],
        },
      ],
      "vite-plus/prefer-vite-plus-imports": LINT_SEVERITY.ERROR,
    },
  }),
  plugins: [{ enforce: "pre", name: "text-modules", transform: textModule }],
  run: {
    tasks: {
      build: [
        "vp run -F '!typescript-template' build",
        "vp run --filter @template/dev private-maps",
      ],
      check: {
        command: [
          "vp check",
          "vp run knip",
          "vp run check:client",
          "vp run check:layers",
          "vp run check:staged",
          "vp run check:effect",
          "vp run -F '!typescript-template' check",
        ],
        input: [...taskInput],
      },
      "check:client": { cache: false, command: "node tools/quality/client-bundle.ts" },
      "check:effect": { cache: false, command: "node tools/quality/effect-diagnostics.ts" },
      "check:layers": applications.map((app) => `steiger apps/${app}/src --fail-on-warnings`),
      "check:staged": { cache: false, command: "node tools/quality/check-staged.ts" },
      knip: {
        command: ["knip", "knip --strict"],
        input: [...taskInput, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
    },
  },
  test: {
    clearMocks: false,
    forceRerunTriggers: [
      "**/package.json",
      "**/tsconfig*.json",
      "pnpm-lock.yaml",
      "**/{vitest,vite}.config.*",
      "**/vitest.*.config.*",
      "libs/ui/.storybook/**",
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
            "apps/**/*.test.ts",
            "tools/quality/**/*.test.ts",
            "tools/observe/**/*.test.ts",
            "infra/**/*.test.ts",
          ],
          name: "node",
        },
      },
      "./tools/quality/vitest.workers.config.ts",
      "./libs/ui/.storybook/vitest.config.ts",
      "./tools/ai-native",
      "./tools/dont-review-it",
      "./tools/lint-rule-authoring",
      "./tools/repository-checks",
      "./tools/stop-ai-slop",
    ],
    restoreMocks: false,
    testTimeout: 30_000,
  },
});
