import { dontReviewItPreset } from "@repo/dont-review-it";
import { LINT_SEVERITY } from "@repo/lint-rule-authoring";

import { retiredImports } from "./retired-packages.ts";

const generatedFiles = ["**/mockServiceWorker.js", "**/routeTree.gen.ts"];

const awaitingPresetPackages = [
  "apps/admin/**",
  "apps/user/**",
  "apps/wiki/**",
  "infra/budget-monitor/**",
  "infra/cloudflare/**",
  "infra/error-monitor/**",
  "infra/health-monitor/**",
  "infra/local/**",
  "libs/auth/**",
  "libs/config/**",
  "libs/db/**",
  "libs/dev-boundary/**",
  "libs/interview/**",
  "libs/monitor/**",
  "libs/observability/**",
  "libs/runtime/**",
  "libs/ui/**",
  "tools/commander/**",
  "tools/dev/**",
  "tools/e2e/**",
  "tools/load/**",
  "tools/observe/**",
  "tools/quality/**",
];

const templateWorkspaces = [
  "apps/**",
  "libs/**",
  "infra/**",
  "tools/commander/**",
  "tools/dev/**",
  "tools/e2e/**",
  "tools/load/**",
  "tools/observe/**",
  "tools/quality/**",
];

const linkComponents = [
  "ButtonLink",
  "CardLink",
  "DropdownMenuLinkItem",
  "Link",
  "NavigationLink",
  "PaginationLink",
  "TextLink",
];

const lintOptions = {
  bundles: "all",
  ignorePatterns: [...generatedFiles, ...awaitingPresetPackages],
  jsPlugins: [
    "./tools/quality/plugin.ts",
    { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    "@shadcn/lint",
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
      files: ["libs/ui/src/shared/ui/**"],
      rules: {
        "react/forbid-component-props": [LINT_SEVERITY.ERROR, { forbid: ["style"] }],
        "shadcn/no-restyle": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "apps/*/src/**/api.ts",
        "apps/*/src/**/*-api.ts",
        "tools/*/src/**/*-api.ts",
        "libs/runtime/src/account.ts",
      ],
      rules: {
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
        "typescript/explicit-module-boundary-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["infra/cloudflare/src/**"],
      rules: {
        "new-cap": [
          LINT_SEVERITY.ERROR,
          {
            capIsNewExceptionPattern:
              "^(?:Schema|Context|Data|Config|ApiToken|D1|Email|Workers|Zone)\\.",
            capIsNewExceptions: ["DurableObject", "InMemoryService", "Stack", "Worker"],
          },
        ],
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
        "no-restricted-imports": [LINT_SEVERITY.ERROR, retiredImports],
        "no-restricted-properties": [
          LINT_SEVERITY.ERROR,
          ...["stdout", "stderr"].map((property) => ({
            message: "effect の Console で出力してください。",
            object: "process",
            property,
          })),
          {
            message: "@repo/config/cli の reportFailed / markFailed / exitWith を使ってください。",
            object: "process",
            property: "exitCode",
          },
          {
            message: "@repo/config/cli の runCli で起動してください。",
            object: "NodeRuntime",
            property: "runMain",
          },
        ],
        "no-underscore-dangle": [LINT_SEVERITY.ERROR, { allow: ["_tag"] }],
        "no-warning-comments": [
          LINT_SEVERITY.ERROR,
          {
            location: "anywhere",
            terms: ["todo", "fixme", "xxx", "eslint-disable", "react-doctor"],
          },
        ],
        "project/annotations": LINT_SEVERITY.ERROR,
        "project/boundaries": LINT_SEVERITY.ERROR,
        "project/cross-request-state": LINT_SEVERITY.ERROR,
        "project/effect-failures": LINT_SEVERITY.ERROR,
        "project/effect-stack": LINT_SEVERITY.ERROR,
        "project/environment-boundary": LINT_SEVERITY.ERROR,
        "project/example-values": LINT_SEVERITY.ERROR,
        "project/git-environment": LINT_SEVERITY.ERROR,
        "project/layers": LINT_SEVERITY.ERROR,
        "project/no-internal-mocks": LINT_SEVERITY.ERROR,
        "project/no-manual-memoization": LINT_SEVERITY.ERROR,
        "project/test-import-graph": LINT_SEVERITY.ERROR,
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
              { from: "lib", name: ["Request", "RequestInit", "Response", "URL", "Uint8Array"] },
              {
                from: "package",
                name: ["Codec", "Effect", "Exit", "ManagedRuntime"],
                package: "effect",
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
              { from: "package", name: ["ToastObject"], package: "@base-ui/react" },
              { from: "package", name: ["ChildProcess", "Readable"], package: "node" },
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
  ],
  rules: {
    "dont-review-it/no-default-export--use-named-export": [
      LINT_SEVERITY.ERROR,
      {
        toolRequiredFileNames: [
          "doctor.config.ts",
          "drizzle.config.ts",
          "knip.ts",
          "main.ts",
          "monitor-fixture.ts",
          "plugin.ts",
          "preview.tsx",
          "server.ts",
          "steiger.config.js",
          "vite.config.ts",
          "vitest-sdk.ts",
          "vitest.config.ts",
          "vitest.mutation.config.ts",
          "vitest.workers.config.ts",
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
        testFileSuffixes: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".worker.test.ts"],
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
          "@repo/ai-native/telemetry",
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
      components: {
        ...Object.fromEntries(linkComponents.map((name) => [name, "a"])),
        Button: "button",
        Checkbox: "button",
        DropdownMenuTrigger: "button",
        Heading: "h2",
      },
      polymorphicPropName: "as",
    },
    react: { linkComponents: linkComponents.map((name) => ({ attribute: "to", name })) },
  },
} satisfies Parameters<typeof dontReviewItPreset.lint>[0];

const configuredLintRules: Readonly<Record<string, unknown>> = Object.assign(
  {},
  lintOptions.rules,
  ...lintOptions.overrides.map((override) => override.rules ?? {}),
);

export { configuredLintRules, generatedFiles, lintOptions };
