import { dontReviewItPreset } from "@repo/dont-review-it";

import { retiredImports } from "./retired-packages.ts";

const generatedFiles = ["**/mockServiceWorker.js", "**/routeTree.gen.ts"];

const linkComponents = [
  "ButtonLink",
  "CardLink",
  "DropdownMenuLinkItem",
  "Link",
  "NavigationLink",
  "PaginationLink",
  "TextLink",
];

const lint = dontReviewItPreset.lint({
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
        "react/exhaustive-deps": "error",
        "react/forbid-component-props": "error",
        "react/jsx-filename-extension": ["error", { extensions: [".tsx"] }],
        "react/jsx-props-no-spreading": "error",
        "react/only-export-components": ["error", { allowExportNames: ["Route"] }],
        "react/rules-of-hooks": "error",
      },
    },
    {
      files: ["libs/ui/src/shared/ui/**"],
      rules: {
        "react/forbid-component-props": ["error", { forbid: ["style"] }],
        "shadcn/no-restyle": "off",
      },
    },
    {
      files: [
        "apps/**",
        "libs/**",
        "infra/**",
        "tools/dev/**",
        "tools/observe/**",
        "tools/quality/**",
      ],
      rules: {
        "no-restricted-properties": [
          "error",
          ...["stdout", "stderr"].map((property) => ({
            message: "effect の Console で出力してください。",
            object: "process",
            property,
          })),
        ],
      },
    },
    {
      files: ["tools/ai-native/**", "tools/lint-rule-authoring/**"],
      rules: {
        "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
      },
    },
    {
      files: ["tools/dont-review-it/src/lint/oxlint/**"],
      rules: {
        "typescript/switch-exhaustiveness-check": [
          "error",
          { considerDefaultExhaustiveForUnions: true },
        ],
      },
    },
    {
      files: ["**/{test,tests,__tests__,spec,__specs__}/**"],
      rules: {
        "vitest/consistent-test-filename": [
          "error",
          { pattern: "place-the-test-file-next-to-its-source-instead-of-a-test-directory" },
        ],
      },
    },
  ],
  rules: {
    "dont-review-it/no-array-mutation--derive-new-array": "error",
    "dont-review-it/no-blanket-suppression--name-and-record": "error",
    "dont-review-it/no-class-as-mutable-cell--decide-in-an-iife": "error",
    "dont-review-it/no-default-export--use-named-export": [
      "error",
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
      "error",
      {
        testFileSuffixes: [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".worker.test.ts"],
      },
    ],
    "dont-review-it/no-empty-catch--throw-or-handle": "error",
    "dont-review-it/no-fixture-forward-subject--yield-sut-output": [
      "error",
      { handlerScopingWrappers: ["runWith"] },
    ],
    "dont-review-it/no-floating-promise--await-the-result": "error",
    "dont-review-it/no-non-boundary-double--replace-at-the-external-boundary": [
      "error",
      {
        externalIoPackages: [
          "@repo/ai-native/telemetry",
          "@opentelemetry/exporter-logs-otlp-http",
          "@opentelemetry/exporter-metrics-otlp-http",
          "@opentelemetry/exporter-trace-otlp-http",
        ],
      },
    ],
    "dont-review-it/no-partial-rule-set--enable-the-whole-set": "error",
    "dont-review-it/no-promise-chain--use-async-await": "error",
    "dont-review-it/no-reassign--use-spread-or-iife": [
      "error",
      {
        assignOnlyTargets: [
          "RuleTester.describe",
          "RuleTester.it",
          "RuleTester.itOnly",
          "globalThis.fetch",
        ],
      },
    ],
    "dont-review-it/no-receiver-mutation--derive-new-value": "error",
    "dont-review-it/no-silent-catch--rethrow-or-handle": "error",
    "import/no-cycle": "error",
    "no-restricted-imports": ["error", retiredImports],
    "project/boundaries": "error",
    "project/effect-failures": "error",
    "project/effect-stack": "error",
    "project/environment-boundary": "error",
    "project/layers": "error",
    "project/no-manual-memoization": "error",
    "project/worker-fetch": "error",
    "shadcn/no-arbitrary-values": "error",
    "shadcn/no-raw-colors": "error",
    "shadcn/no-restyle": ["error", { allow: ["layout", "spacing"] }],
    "shadcn/no-unknown-classes": "error",
    "typescript/only-throw-error": [
      "error",
      {
        allow: [
          { from: "package", name: "NotFoundError", package: "@tanstack/router-core" },
          { from: "package", name: "Redirect", package: "@tanstack/router-core" },
        ],
      },
    ],
    "vite-plus/prefer-vite-plus-imports": "error",
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
});

export { generatedFiles, lint };
