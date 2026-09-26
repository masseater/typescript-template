import {
  cloudflareNewCapExceptions,
  cloudflareSourceFiles,
} from "@repo/infra-cloudflare/lint-overrides";

import { dontReviewItPreset } from "../configs/preset.ts";
import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { filePathOf } from "../platform/path.ts";
import { fileScopedOverrides } from "./file-scoped-overrides.ts";
import { softPresetPackages, softPresetRules } from "./soft-preset.ts";
import {
  linkComponents,
  linkWrapperFiles,
  uiA11yComponents,
  uiQualityInspectionFiles,
  uiSharedPartFiles,
} from "./ui-lint-settings.ts";

const nodeBuiltinBoundaryFiles = [
  "infra/cloudflare/src/features/cloudflare/deployment.ts",
  "libs/config/src/features/config/local-database-path.test.ts",
  "libs/config/src/features/config/process-environment.test.ts",
  "libs/telemetry/src/features/telemetry/telemetry.test.ts",
  "libs/vite-config/src/features/vite-config/cloudflare-workers-loader.ts",
  "libs/vite-config/src/features/vite-config/elysia-aot.ts",
  "tools/ai-native/src/features/ai-native/host-facts.ts",
  "tools/dev/src/features/dev/ci-runner.test.ts",
  "tools/dev/src/features/dev/ci-runner.ts",
  "tools/dev/src/features/dev/dev-start.ts",
  "tools/dev/src/features/dev/local-environment.ts",
  "tools/dev/src/features/dev/observe/source-maps.ts",
  "tools/dont-review-it/src/features/dont-review-it/configs/git-excludes/git-exclude-patterns.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/configs/git-excludes/git-exclude-patterns.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/catalog-build-lock.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/catalog-cache-fingerprint.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/catalog-cache-validation.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/catalog-cache.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/export-specifier-index.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/fingerprint.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/import-route-resolution.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/import-route-source-identity.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/import-route.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/canonical-values/source-files.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/git-ignored-source.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/git-output.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/out-of-scope-source.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/repository-scan/worktree-files.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/setup-modules/specifier-resolution.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/lib/spec-syntax/module-declarations.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/rules/testing/no-detached-test-file--move-beside-source.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/rules/testing/no-detached-test-file--move-beside-source.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/rules/toolchain/no-standalone-tsconfig--extend-shared-preset.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/lint/oxlint/rules/writing/forbid-numbered-sibling-file--name-what-each-file-owns.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository-checks/git-executable.test.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository-checks/git-executable.ts",
  "tools/dont-review-it/src/features/dont-review-it/repository/tool-test-projects.ts",
  "tools/load/src/features/load/environment.ts",
];

const generatedFiles = ["**/mockServiceWorker.js", "**/routeTree.gen.ts", "**/.paraglide/**"];

const awaitingPresetPackages: readonly string[] = [];

const templateWorkspaces = [
  "apps/**",
  "libs/**",
  "infra/**",
  "tools/dev/**",
  "tools/e2e/**",
  "tools/load/**",
  "tools/dont-review-it/**",
];

const apiBoundaryFiles = [
  "apps/*/src/**/api.ts",
  "apps/*/src/**/*-api.ts",
  "tools/*/src/**/*-api.ts",
  "libs/runtime/src/features/runtime/account.ts",
];

const lintOptions = {
  bundles: "all",
  ignorePatterns: [...generatedFiles, ...awaitingPresetPackages, ...uiQualityInspectionFiles],
  jsPlugins: [
    { name: "project", specifier: filePathOf(new URL("./plugin.ts", import.meta.url)) },
    { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    { name: "shadcn", specifier: "@shadcn/lint" },
  ],
  options: { denyWarnings: true, typeAware: true, typeCheck: true },
  overrides: [
    {
      files: templateWorkspaces,
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
      files: uiSharedPartFiles,
      plugins: ["react"],
      rules: {
        "react/forbid-component-props": [LINT_SEVERITY.ERROR, { forbid: ["style"] }],
      },
    },
    {
      files: linkWrapperFiles,
      plugins: ["react"],
      rules: { "react/jsx-props-no-spreading": LINT_SEVERITY.OFF },
    },
    {
      files: apiBoundaryFiles,
      rules: {
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
        "typescript/explicit-module-boundary-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: templateWorkspaces,
      rules: {
        "import/no-cycle": LINT_SEVERITY.ERROR,
        "max-lines": [LINT_SEVERITY.ERROR, { max: 500 }],
        "new-cap": [
          LINT_SEVERITY.ERROR,
          { capIsNewExceptionPattern: "^(?:Schema|Context|Data)\\." },
        ],
        "no-underscore-dangle": [LINT_SEVERITY.ERROR, { allow: ["_tag"] }],
        "no-warning-comments": [
          LINT_SEVERITY.ERROR,
          {
            location: "anywhere",
            terms: ["todo", "fixme", "xxx", "eslint-disable", "oxlint-disable", "react-doctor"],
          },
        ],
        "project/annotations": LINT_SEVERITY.ERROR,
        "project/app-frame-sidebar": LINT_SEVERITY.ERROR,
        "project/atom-server-data": LINT_SEVERITY.ERROR,
        "project/atom-state": LINT_SEVERITY.ERROR,
        "project/boundaries": LINT_SEVERITY.ERROR,
        "project/cross-request-state": LINT_SEVERITY.ERROR,
        "project/effect-event-deps": LINT_SEVERITY.ERROR,
        "project/effect-failures": LINT_SEVERITY.ERROR,
        "project/effect-stack": LINT_SEVERITY.ERROR,
        "project/environment-boundary": LINT_SEVERITY.ERROR,
        "project/example-values": LINT_SEVERITY.ERROR,
        "project/git-environment": LINT_SEVERITY.ERROR,
        "project/layers": LINT_SEVERITY.ERROR,
        "project/lazy-motion": LINT_SEVERITY.ERROR,
        "project/modular-imports": LINT_SEVERITY.ERROR,
        "project/modular-layers": LINT_SEVERITY.ERROR,
        "project/thin-app-routes": LINT_SEVERITY.ERROR,
        "project/logs": LINT_SEVERITY.ERROR,
        "project/no-internal-mocks": LINT_SEVERITY.ERROR,
        "project/no-manual-memoization": LINT_SEVERITY.ERROR,
        "project/process-boundary": LINT_SEVERITY.ERROR,
        "project/react-legacy": LINT_SEVERITY.ERROR,
        "project/retired-imports": LINT_SEVERITY.ERROR,
        "project/span-mutation": LINT_SEVERITY.ERROR,
        "project/temp-directory": LINT_SEVERITY.ERROR,
        "project/test-import-graph": LINT_SEVERITY.ERROR,
        "project/wareki-format": LINT_SEVERITY.ERROR,
        "project/worker-fetch": LINT_SEVERITY.ERROR,
        "shadcn/no-arbitrary-values": LINT_SEVERITY.ERROR,
        "shadcn/no-raw-colors": LINT_SEVERITY.ERROR,
        "shadcn/no-restyle": [LINT_SEVERITY.ERROR, { allow: ["layout", "spacing"] }],
        "shadcn/no-unknown-classes": LINT_SEVERITY.ERROR,
        "typescript/explicit-function-return-type": [
          LINT_SEVERITY.ERROR,
          { allowedNames: ["createApi", "createAuth"] },
        ],
        "typescript/explicit-module-boundary-types": [
          LINT_SEVERITY.ERROR,
          { allowedNames: ["createApi", "createAuth"] },
        ],
        "typescript/only-throw-error": [
          LINT_SEVERITY.ERROR,
          {
            allow: [
              { from: "package", name: "NotFoundError", package: "@tanstack/router-core" },
              { from: "package", name: "Redirect", package: "@tanstack/router-core" },
            ],
          },
        ],
        "typescript/prefer-readonly-parameter-types": [
          LINT_SEVERITY.ERROR,
          {
            allow: [
              {
                from: "lib",
                name: [
                  "Error",
                  "Headers",
                  "Request",
                  "RequestInit",
                  "Response",
                  "URL",
                  "Uint8Array",
                ],
              },
              {
                from: "package",
                name: [
                  "Codec",
                  "Command",
                  "Deferred",
                  "Duration",
                  "Effect",
                  "Exit",
                  "ManagedRuntime",
                  "Queue",
                  "Redacted",
                  "Ref",
                ],
                package: "effect",
              },
              {
                from: "package",
                name: ["Auth", "BetterAuthOptions", "GenericEndpointContext"],
                package: "better-auth",
              },
              {
                from: "package",
                name: ["MiddlewareContext", "MiddlewareOptions"],
                package: "better-call",
              },
              {
                from: "package",
                name: ["Ai", "DurableObjectState", "Request"],
                package: "@cloudflare/workers-types",
              },
              { from: "package", name: ["Column", "DrizzleD1Database"], package: "drizzle-orm" },
              { from: "package", name: ["AnyElysia"], package: "elysia" },
              { from: "package", name: ["Plan", "ProgressEvent"], package: "alchemy" },
              {
                from: "package",
                name: ["PluginOption", "InlineConfig"],
                package: "@voidzero-dev/vite-plus-core",
              },
              {
                from: "package",
                name: ["Browser", "BrowserContext", "Locator", "Page"],
                package: "playwright-core",
              },
              { from: "package", name: ["ReactElement"], package: "react" },
              { from: "package", name: ["ChildProcess", "Readable"], package: "node" },
              { from: "package", name: ["Theme"], package: "baseui" },
            ],
            ignoreInferredTypes: true,
            treatMethodsAsReadonly: true,
          },
        ],
        "unicorn/text-encoding-identifier-case": [LINT_SEVERITY.ERROR, { withDash: true }],
        "vite-plus/prefer-vite-plus-imports": LINT_SEVERITY.ERROR,
      },
    },
    {
      files: cloudflareSourceFiles,
      rules: {
        "new-cap": [LINT_SEVERITY.ERROR, cloudflareNewCapExceptions],
      },
    },
    ...fileScopedOverrides,
    {
      files: softPresetPackages,
      rules: softPresetRules,
    },
    {
      files: softPresetPackages,
      rules: { "project/process-boundary": [LINT_SEVERITY.ERROR, { builtinLoaderOnly: true }] },
    },
    {
      files: nodeBuiltinBoundaryFiles,
      rules: {
        "import/no-nodejs-modules": LINT_SEVERITY.OFF,
      },
    },
  ],
  rules: {
    "import/no-default-export": LINT_SEVERITY.OFF,
    "import/no-nodejs-modules": LINT_SEVERITY.ERROR,
    "project/process-boundary": [LINT_SEVERITY.ERROR, { builtinLoaderOnly: true }],
    "dont-review-it/no-lenient-coverage-threshold--demand-full-coverage": [
      LINT_SEVERITY.ERROR,
      { branches: 50, functions: 50, lines: 50, statements: 50 },
    ],
    "dont-review-it/no-default-export--use-named-export": [
      LINT_SEVERITY.ERROR,
      {
        toolRequiredFileNames: [
          "alchemy.run.ts",
          "cold-start-test-fixture.ts",
          "doctor.config.ts",
          "drizzle.config.ts",
          "main.ts",
          "monitor-test-fixture.ts",
          "plugin.ts",
          "preview.tsx",
          "server.ts",
          "vite.config.ts",
          "vitest-sdk.ts",
          "vitest.config.ts",
          "vitest.mutation.config.ts",
          "vitest.workers.config.ts",
          "vitest.workers.main.ts",
          "worker.ts",
        ],
      },
    ],
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
    "dont-review-it/no-detached-test-file--move-beside-source": [
      LINT_SEVERITY.ERROR,
      {
        testFileSuffixes: [
          ".test.ts",
          ".test.tsx",
          ".spec.ts",
          ".spec.tsx",
          ".worker.test.ts",
          ".node.test.ts",
          ".isolated.test.ts",
          ".dev-server.test.ts",
        ],
      },
    ],
    "dont-review-it/no-fixture-forward-subject--yield-sut-output": [
      LINT_SEVERITY.ERROR,
      { handlerScopingWrappers: ["runWith"] },
    ],
    "dont-review-it/no-non-boundary-double--replace-at-the-external-boundary": [
      LINT_SEVERITY.ERROR,
      {
        externalIoPackages: [
          "@repo/ai-native-telemetry",
          "@opentelemetry/exporter-logs-otlp-http",
          "@opentelemetry/exporter-metrics-otlp-http",
          "@opentelemetry/exporter-trace-otlp-http",
        ],
      },
    ],
  },
  settings: {
    "jsx-a11y": {
      attributes: { href: ["href", "to"] },
      components: uiA11yComponents,
      polymorphicPropName: "as",
    },
    react: { linkComponents: linkComponents.map((name) => ({ attribute: "to", name })) },
  },
} satisfies Parameters<typeof dontReviewItPreset.lint>[0];

export { awaitingPresetPackages, generatedFiles, lintOptions, templateWorkspaces };
