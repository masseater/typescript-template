import { fileURLToPath } from "node:url";

import { recommended as effectRecommended } from "@effect/tsgo/oxlint-presets";
import {
  cloudflareNewCapExceptions,
  cloudflareSourceFiles,
} from "@repo/infra-cloudflare/lint-overrides";

import { dontReviewItPreset } from "../configs/preset.ts";
import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import {
  linkComponents,
  linkWrapperFiles,
  reactElementTypeFiles,
  uiA11yComponents,
  uiQualityInspectionFiles,
  uiSharedPartFiles,
} from "./ui-lint-settings.ts";

const midPresetEffectPackages = ["libs/db/**", "libs/runtime/**", "libs/observability/**"];

const midPresetEffectRules = Object.fromEntries(
  Object.keys(effectRecommended.rules ?? {}).map((ruleName) => [ruleName, LINT_SEVERITY.OFF]),
);

const generatedFiles = ["**/mockServiceWorker.js", "**/routeTree.gen.ts", "**/.paraglide/**"];

const awaitingPresetPackages = [
  "apps/service-admin/**",
  "apps/service-member/**",
  "apps/internal-dashboard/**",
  "infra/cloudflare/**",
  "tools/dev/**",
  "tools/dont-review-it/**",
];

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
  "libs/runtime/src/account.ts",
];

const authUiServerReadsAwaitingQuery = [
  "libs/auth-ui/src/email-change-confirmation.tsx",
  "libs/auth-ui/src/email-change-verification.tsx",
  "libs/auth-ui/src/email-verification.tsx",
  "libs/auth-ui/src/use-passkeys.ts",
  "libs/auth-ui/src/use-session.ts",
];

const lintOptions = {
  bundles: "all",
  ignorePatterns: [...generatedFiles, ...awaitingPresetPackages, ...uiQualityInspectionFiles],
  jsPlugins: [
    { name: "project", specifier: fileURLToPath(new URL("./plugin.ts", import.meta.url)) },
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
      files: cloudflareSourceFiles,
      rules: {
        "new-cap": [LINT_SEVERITY.ERROR, cloudflareNewCapExceptions],
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
        "project/atom-server-data": LINT_SEVERITY.ERROR,
        "project/atom-state": LINT_SEVERITY.ERROR,
        "project/boundaries": LINT_SEVERITY.ERROR,
        "project/cross-request-state": LINT_SEVERITY.ERROR,
        "project/effect-failures": LINT_SEVERITY.ERROR,
        "project/effect-stack": LINT_SEVERITY.ERROR,
        "project/environment-boundary": LINT_SEVERITY.ERROR,
        "project/example-values": LINT_SEVERITY.ERROR,
        "project/git-environment": LINT_SEVERITY.ERROR,
        "project/layers": LINT_SEVERITY.ERROR,
        "project/thin-app-routes": LINT_SEVERITY.ERROR,
        "project/logs": LINT_SEVERITY.ERROR,
        "project/no-internal-mocks": LINT_SEVERITY.ERROR,
        "project/no-manual-memoization": LINT_SEVERITY.ERROR,
        "project/process-boundary": LINT_SEVERITY.ERROR,
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
                name: ["Codec", "Effect", "Exit", "ManagedRuntime", "Queue", "Ref"],
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
      files: ["libs/runtime/src/worker.ts"],
      rules: {
        "eslint/max-params": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: midPresetEffectPackages,
      rules: midPresetEffectRules,
    },
    {
      files: [
        "libs/db/src/security.ts",
        "libs/db/src/remote-http.test.ts",
        "libs/db/src/identity-schema.ts",
        "infra/budget-monitor/src/decision.ts",
        "infra/error-monitor/src/telemetry.ts",
        "libs/observability/src/server-testing.ts",
        "tools/ai-native/src/spool/run-spool.node.test.ts",
      ],
      rules: {
        "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-spec-file-helper-function--inline-or-use-fixture": LINT_SEVERITY.OFF,
        "project/effect-failures": LINT_SEVERITY.OFF,
        "dont-review-it/no-detached-declaration--declare-it-next-to-its-use": LINT_SEVERITY.OFF,
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "effecttsgo/any-unknown-in-error-context": LINT_SEVERITY.OFF,
        "dont-review-it/no-detached-test-file--move-beside-source": LINT_SEVERITY.OFF,
      },
    },

    {
      files: [
        "libs/monitor/src/monitor-base.ts",
        "libs/monitor/src/monitor-worker.ts",
        "libs/monitor/src/monitor-fixture.ts",
      ],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "typescript/no-this-alias": LINT_SEVERITY.OFF,
        "eslint/max-params": LINT_SEVERITY.OFF,
        "effecttsgo/any-unknown-in-error-context": LINT_SEVERITY.OFF,
      },
    },

    {
      files: [
        "libs/config/src/local-database-path.test.ts",
        "libs/config/src/repository-root.test.ts",
      ],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
        "dont-review-it/require-test-block-for-spec-file--add-test-or-delete-file":
          LINT_SEVERITY.OFF,
        "project/effect-failures": LINT_SEVERITY.OFF,
        "typescript/no-dynamic-delete": LINT_SEVERITY.OFF,
      },
    },

    {
      files: ["infra/budget-monitor/src/billing.ts", "infra/budget-monitor/src/decision.ts"],
      rules: {
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-single-use-local-type--inline-at-the-use-site": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/db/src/records-fixture.ts", "libs/runtime/src/jobs.ts"],
      rules: {
        "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "infra/budget-monitor/src/decision.worker.test.ts",
        "infra/budget-monitor/src/billing.worker.test.ts",
      ],
      rules: {
        "dont-review-it/no-spec-file-helper-function--inline-or-use-fixture": LINT_SEVERITY.OFF,
        "eslint/func-style": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "eslint/max-params": LINT_SEVERITY.OFF,
        "eslint/no-duplicate-imports": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/vite-config/**",
        "infra/local/**",
        "infra/error-monitor/**",
        "infra/health-monitor/**",
        "libs/monitor/**",
      ],
      rules: midPresetEffectRules,
    },
    {
      files: [
        "libs/config/**/*.test.ts",
        "infra/local/**/*.test.ts",
        "infra/error-monitor/**/*.test.ts",
        "infra/health-monitor/**/*.test.ts",
        "infra/budget-monitor/**/*.test.ts",
        "infra/budget-monitor/**/*.worker.test.ts",
        "libs/monitor/**/*.test.ts",
        "libs/vite-config/**/*.test.ts",
      ],
      rules: midPresetEffectRules,
    },
    {
      files: [
        "libs/runtime/src/http.ts",
        "libs/runtime/src/bindings.ts",
        "libs/runtime/src/jobs.ts",
        "libs/runtime/src/configured-app-layer.ts",
        "libs/runtime/src/account.ts",
        "libs/db/src/remote-operations.ts",
        "libs/observability/src/annotations.ts",
        "libs/observability/src/request.ts",
        "libs/monitor/src/monitor-fixture.ts",
      ],
      rules: {
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
        "typescript/explicit-module-boundary-types": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/http.ts"],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-blanket-suppression--name-and-record": LINT_SEVERITY.OFF,
        "dont-review-it/no-detached-declaration--declare-it-next-to-its-use": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-interface-declaration--write-a-type-alias": LINT_SEVERITY.OFF,
        "dont-review-it/no-lint-suppression-in-spec--fix-the-violation": LINT_SEVERITY.OFF,
        "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.OFF,
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
        "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.OFF,
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "eslint/func-style": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
        "eslint/max-params": LINT_SEVERITY.OFF,
        "eslint/max-statements": LINT_SEVERITY.OFF,
        "eslint/no-duplicate-imports": LINT_SEVERITY.OFF,
        "eslint/no-warning-comments": LINT_SEVERITY.OFF,
        "typescript/consistent-indexed-object-style": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/account.ts", "libs/runtime/src/client.ts"],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "eslint/func-style": LINT_SEVERITY.OFF,
        "eslint/no-duplicate-imports": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/responses.ts"],
      rules: {
        "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/observability/src/redact.ts"],
      rules: {
        "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.OFF,
        "eslint/max-statements": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/database-health.ts", "libs/runtime/src/worker-runtime.ts"],
      rules: {
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/bindings.ts"],
      rules: {
        "eslint/max-classes-per-file": LINT_SEVERITY.OFF,
        "new-cap": [
          LINT_SEVERITY.ERROR,
          {
            capIsNewExceptionPattern: "^(?:Schema|Context|Data|Binding|D1|Email|WorkersAi)\\.",
          },
        ],
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/vite-config/src/elysia-aot.ts"],
      rules: {
        "max-lines": LINT_SEVERITY.OFF,
        "project/effect-stack": LINT_SEVERITY.OFF,
        "typescript/no-deprecated": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/vite-config/src/cloudflare-workers-loader.mjs"],
      rules: {
        "max-params": LINT_SEVERITY.OFF,
        "typescript/no-unsafe-call": LINT_SEVERITY.OFF,
        "typescript/no-unsafe-return": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/vite-config/src/cloudflare-workers-stub.mjs",
        "libs/vite-config/src/cloudflare-workflows-stub.mjs",
      ],
      rules: {
        "max-classes-per-file": LINT_SEVERITY.OFF,
        "typescript/no-extraneous-class": LINT_SEVERITY.OFF,
      },
    },
    {
      files: authUiServerReadsAwaitingQuery,
      rules: {
        "dont-review-it/no-hand-rolled-server-read--use-tanstack-query": LINT_SEVERITY.OFF,
        "project/atom-server-data": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/auth/src/request-hooks.ts"],
      rules: {
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/auth/src/auth-request.ts",
        "libs/auth/src/auth-test-fixture.ts",
        "libs/auth/src/browser-client.ts",
        "libs/auth/src/email-change.ts",
        "libs/auth/src/email-change.worker.test.ts",
        "libs/auth/src/wiki-oauth-fixture.ts",
      ],
      rules: {
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/auth/src/auth-request.ts",
        "libs/auth/src/browser-client.ts",
        "libs/auth/src/session.ts",
        "libs/auth/src/session-token.ts",
      ],
      rules: {
        "eslint/max-statements": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/auth/src/create-auth.ts", "libs/auth/src/email.ts"],
      rules: {
        "dont-review-it/no-detached-declaration--declare-it-next-to-its-use": LINT_SEVERITY.OFF,
      },
    },
    {
      files: reactElementTypeFiles,
      rules: { "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF },
    },
    {
      files: [
        "tools/ai-native/**",
        "tools/ai-native-telemetry/**",
        "tools/dont-review-it/src/lint-rule-authoring/**",
      ],
      rules: {
        "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/config/src/cli.ts"],
      rules: {
        "no-restricted-properties": [
          LINT_SEVERITY.ERROR,
          ...["stdout", "stderr"].map((property) => ({
            message: "effect の Console で出力してください。",
            object: "process",
            property,
          })),
        ],
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
      files: ["libs/db/src/testing.ts", "libs/monitor/src/monitor-fixture.ts"],
      rules: {
        "dont-review-it/no-explanatory-comment--delete-or-move-to-commit-message":
          LINT_SEVERITY.OFF,
        "typescript/no-namespace": LINT_SEVERITY.OFF,
        "typescript/triple-slash-reference": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/auth/src/email-change.worker.test.ts"],
      rules: {
        "dont-review-it/no-dry-test-setup--inline-owned-setup": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/db/src/member-social-schema.ts"],
      rules: {
        "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values":
          LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "infra/cloudflare/src/unix-permission-bits.ts",
        "tools/dev/src/unix-permission-bits.ts",
      ],
      rules: {
        "no-bitwise": LINT_SEVERITY.OFF,
      },
    },
  ],
  rules: {
    "import/no-default-export": LINT_SEVERITY.OFF,
    "dont-review-it/no-lenient-coverage-threshold--demand-full-coverage": [
      LINT_SEVERITY.ERROR,
      { branches: 50, functions: 50, lines: 50, statements: 50 },
    ],
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

const configuredLintRules: Readonly<Record<string, unknown>> = Object.assign(
  {},
  lintOptions.rules,
  ...lintOptions.overrides
    .filter((override) => override.files?.includes("libs/**") === true)
    .map((override) => override.rules ?? {}),
);

const builtInPlugins: ReadonlySet<string> = new Set([
  "eslint",
  "import",
  "jest",
  "jsdoc",
  "jsx-a11y",
  "nextjs",
  "node",
  "oxc",
  "promise",
  "react",
  "react-perf",
  "typescript",
  "unicorn",
  "vitest",
  "vue",
]);

const overridePluginMismatches = (overrides: typeof lintOptions.overrides): readonly string[] => {
  return overrides.flatMap((override, index) => {
    const plugins = override.plugins;
    if (plugins === undefined) {
      return [];
    }
    const enabled = new Set<string>(plugins);
    return Object.keys(override.rules ?? {}).flatMap((rule) => {
      const plugin = rule.includes("/") ? rule.slice(0, rule.indexOf("/")) : "eslint";
      if (!builtInPlugins.has(plugin) || enabled.has(plugin)) {
        return [];
      }
      return [`overrides[${String(index)}] ${rule} needs plugins to include ${plugin}`];
    });
  });
};

export {
  awaitingPresetPackages,
  configuredLintRules,
  generatedFiles,
  lintOptions,
  overridePluginMismatches,
  templateWorkspaces,
};
