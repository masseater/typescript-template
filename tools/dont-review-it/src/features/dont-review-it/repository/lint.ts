import {
  cloudflareNewCapExceptions,
  cloudflareSourceFiles,
} from "@repo/infra-cloudflare/lint-overrides";

import { dontReviewItPreset } from "../configs/preset.ts";
import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { filePathOf } from "../platform/path.ts";
import {
  linkComponents,
  linkWrapperFiles,
  reactElementTypeFiles,
  uiA11yComponents,
  uiQualityInspectionFiles,
  uiSharedPartFiles,
} from "./ui-lint-settings.ts";

const softPresetPackages = [
  "apps/service-admin/**",
  "apps/service-member/**",
  "apps/internal-dashboard/**",
  "apps/internal-wiki/**",
  "infra/cloudflare/**",
  "tools/dev/**",
  "tools/dont-review-it/**",
];

const softPresetRules = Object.fromEntries(
  [
    "dont-review-it/forbid-expectless-it--assert-or-delete-it",
    "dont-review-it/forbid-multi-expect-it--split-into-separate-it",
    "dont-review-it/forbid-oversized-file--split-by-responsibility",
    "dont-review-it/forbid-unresolvable-module-specifier--write-a-statically-resolvable-specifier",
    "dont-review-it/forbid-weak-matcher--use-exact-matcher",
    "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun",
    "dont-review-it/no-array-mutation--derive-new-array",
    "dont-review-it/no-default-export--use-named-export",
    "dont-review-it/no-detached-declaration--declare-it-next-to-its-use",
    "dont-review-it/no-detached-test-file--move-beside-source",
    "dont-review-it/no-double-type-assertion--declare-the-real-type",
    "dont-review-it/no-dry-test-setup--inline-owned-setup",
    "dont-review-it/no-duplicate-value-declaration--reuse-authoritative-value",
    "dont-review-it/no-expect-call-expression--yield-from-fixture",
    "dont-review-it/no-expect-forbidden-subject-name--rename-to-concrete-subject",
    "dont-review-it/no-expect-member-subject--yield-subject-from-fixture",
    "dont-review-it/no-expect-outside-it--move-into-it-block",
    "dont-review-it/no-expect-projected-subject--use-tostrictequal-on-subject",
    "dont-review-it/no-expect-synthetic-subject--yield-from-fixture",
    "dont-review-it/no-explanatory-comment--delete-or-move-to-commit-message",
    "dont-review-it/no-hardcoded-endpoint--read-from-configuration",
    "dont-review-it/no-interface-declaration--write-a-type-alias",
    "dont-review-it/no-lenient-coverage-threshold--demand-full-coverage",
    "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values",
    "dont-review-it/no-module-scope-mock-config--lift-into-fixture",
    "dont-review-it/no-module-scope-mutable-state--lift-into-fixture",
    "dont-review-it/no-partial-rule-set--enable-the-whole-set",
    "dont-review-it/no-promise-chain--use-async-await",
    "dont-review-it/no-reassign--use-spread-or-iife",
    "dont-review-it/no-receiver-mutation--derive-new-value",
    "dont-review-it/no-redundant-mock-reset--lift-mocks-into-fixture",
    "dont-review-it/no-shared-double-state--reset-doubles-between-tests",
    "dont-review-it/no-single-use-local-type--inline-at-the-use-site",
    "dont-review-it/no-spec-file-helper-function--inline-or-use-fixture",
    "dont-review-it/no-standalone-tsconfig--extend-shared-preset",
    "dont-review-it/no-sut-independent-assertion--assert-fixture-subject",
    "dont-review-it/no-test-context-escape--destructure-fixtures-by-name",
    "dont-review-it/no-twin-declaration--merge-into-one-owner",
    "dont-review-it/no-unchecked-cast--parse-at-boundary",
    "dont-review-it/no-unordered-import--group-by-origin-then-sort-by-specifier",
    "dont-review-it/no-unregistered-rule-plugin--enable-the-plugin",
    "dont-review-it/require-it-only-expect--move-setup-into-fixture",
    "dont-review-it/require-re-export-only-files--move-declaration-to-owning-module",
    "dont-review-it/require-test-block-for-spec-file--add-test-or-delete-file",
    "dont-review-it/require-test-block-spelling--use-configured-fn",
    "effecttsgo/any-unknown-in-error-context",
    "effecttsgo/crypto-random-uuid",
    "effecttsgo/crypto-random-uuid-in-effect",
    "eslint/complexity",
    "eslint/eqeqeq",
    "eslint/func-style",
    "eslint/max-classes-per-file",
    "eslint/max-lines",
    "eslint/max-nested-callbacks",
    "eslint/max-params",
    "eslint/max-statements",
    "eslint/no-duplicate-imports",
    "eslint/no-underscore-dangle",
    "eslint/no-warning-comments",
    "import/no-named-as-default",
    "jsx-a11y/heading-has-content",
    "lint-rule-authoring/forbid-symbol-prefixed-name--rename-to-alphanumeric-start",
    "new-cap",
    "project/atom-server-data",
    "project/atom-state",
    "project/boundaries",
    "project/effect-failures",
    "project/example-values",
    "project/git-environment",
    "project/logs",
    "project/no-internal-mocks",
    "project/test-import-graph",
    "project/wareki-format",
    "project/worker-fetch",
    "react/forbid-component-props",
    "react/function-component-definition",
    "react/jsx-curly-brace-presence",
    "react/jsx-handler-names",
    "react/jsx-max-depth",
    "react/jsx-no-literals",
    "react/jsx-props-no-spreading",
    "react/no-children-prop",
    "react/no-multi-comp",
    "react/no-unstable-nested-components",
    "react/only-export-components",
    "react/rules-of-hooks",
    "react/set-state-in-effect",
    "shadcn/no-arbitrary-values",
    "shadcn/no-raw-colors",
    "shadcn/no-unknown-classes",
    "typescript/array-type",
    "typescript/consistent-type-imports",
    "typescript/dot-notation",
    "typescript/explicit-function-return-type",
    "typescript/explicit-module-boundary-types",
    "typescript/no-base-to-string",
    "typescript/no-confusing-void-expression",
    "typescript/no-deprecated",
    "typescript/no-dynamic-delete",
    "typescript/no-floating-promises",
    "typescript/no-this-alias",
    "typescript/no-unnecessary-boolean-literal-compare",
    "typescript/no-unnecessary-condition",
    "typescript/no-unnecessary-type-arguments",
    "typescript/no-unnecessary-type-assertion",
    "typescript/no-unnecessary-type-parameters",
    "typescript/no-unsafe-argument",
    "typescript/no-unsafe-assignment",
    "typescript/no-unsafe-call",
    "typescript/no-unsafe-member-access",
    "typescript/no-unsafe-return",
    "typescript/prefer-optional-chain",
    "typescript/prefer-readonly-parameter-types",
    "typescript/strict-boolean-expressions",
    "unicorn/text-encoding-identifier-case",
    "vitest/no-conditional-expect",
    "vitest/no-standalone-expect",
  ].map((ruleName) => [ruleName, LINT_SEVERITY.OFF]),
);

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

const authUiServerReadsAwaitingQuery = [
  "libs/auth-ui/src/features/auth-ui/email-change-confirmation.tsx",
  "libs/auth-ui/src/features/auth-ui/email-change-verification.tsx",
  "libs/auth-ui/src/features/auth-ui/email-verification.tsx",
  "libs/auth-ui/src/features/auth-ui/use-passkeys.ts",
  "libs/auth-ui/src/features/auth-ui/use-session.ts",
];

const lintOptions = {
  bundles: "all",
  ignorePatterns: [...generatedFiles, ...awaitingPresetPackages, ...uiQualityInspectionFiles],
  jsPlugins: [
    { name: "project", specifier: filePathOf(new URL("./plugin.ts", import.meta.url)) },
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
      files: ["libs/runtime/src/features/runtime/worker.ts"],
      rules: {
        "eslint/max-params": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/db/src/features/db/security.ts",
        "libs/db/src/features/db/local-platform.test.ts",
        "libs/db/src/features/db/identity-schema.ts",
        "infra/budget-monitor/src/features/budget-monitor/decision.ts",
        "infra/error-monitor/src/features/error-monitor/telemetry.ts",
        "tools/ai-native/src/features/ai-native/spool/run-spool.node.test.ts",
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
        "libs/monitor/src/features/monitor/monitor-base.ts",
        "libs/monitor/src/features/monitor/monitor-worker.ts",
        "libs/monitor/src/features/monitor/monitor-test-fixture.ts",
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
        "libs/config/src/features/config/local-database-path.test.ts",
        "libs/config/src/features/config/repository-root.test.ts",
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
      files: [
        "infra/budget-monitor/src/features/budget-monitor/billing.ts",
        "infra/budget-monitor/src/features/budget-monitor/decision.ts",
      ],
      rules: {
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-single-use-local-type--inline-at-the-use-site": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/db/src/features/db/records-test-fixture.ts",
        "libs/runtime/src/features/runtime/jobs.ts",
      ],
      rules: {
        "dont-review-it/no-promise-chain--use-async-await": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "infra/budget-monitor/src/features/budget-monitor/decision.worker.test.ts",
        "infra/budget-monitor/src/features/budget-monitor/billing.worker.test.ts",
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
        "libs/runtime/src/features/runtime/http.ts",
        "libs/runtime/src/features/runtime/bindings.ts",
        "libs/runtime/src/features/runtime/jobs.ts",
        "libs/runtime/src/features/runtime/configured-app-layer.ts",
        "libs/runtime/src/features/runtime/account.ts",
        "libs/db/src/features/db/remote-operations.ts",
        "libs/observability/src/features/observability/annotations.ts",
        "libs/observability/src/features/observability/request.ts",
        "libs/monitor/src/features/monitor/monitor-test-fixture.ts",
      ],
      rules: {
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
        "typescript/explicit-module-boundary-types": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/features/runtime/http.ts"],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-blanket-suppression--name-and-record": LINT_SEVERITY.OFF,
        "dont-review-it/no-detached-declaration--declare-it-next-to-its-use": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-interface-declaration--write-a-type-alias": LINT_SEVERITY.OFF,
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
      files: [
        "libs/runtime/src/features/runtime/account.ts",
        "libs/runtime/src/features/runtime/client.ts",
      ],
      rules: {
        "dont-review-it/no-ambiguous-variable-name--rename-to-concrete-noun": LINT_SEVERITY.OFF,
        "dont-review-it/no-duplicated-body--import-the-existing-declaration": LINT_SEVERITY.OFF,
        "dont-review-it/no-twin-declaration--merge-into-one-owner": LINT_SEVERITY.OFF,
        "eslint/func-style": LINT_SEVERITY.OFF,
        "eslint/no-duplicate-imports": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/features/runtime/responses.ts"],
      rules: {
        "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/observability/src/features/observability/redact.ts"],
      rules: {
        "dont-review-it/no-receiver-mutation--derive-new-value": LINT_SEVERITY.OFF,
        "eslint/max-statements": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/runtime/src/features/runtime/database-health.ts",
        "libs/runtime/src/features/runtime/worker-runtime.ts",
      ],
      rules: {
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/runtime/src/features/runtime/bindings.ts"],
      rules: {
        "eslint/max-classes-per-file": LINT_SEVERITY.OFF,
        "new-cap": [
          LINT_SEVERITY.ERROR,
          {
            capIsNewExceptionPattern:
              "^(?:Schema|Context|Data|Config|Binding|D1|Email|WorkersAi)\\.",
          },
        ],
        "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
      },
    },
    {
      files: cloudflareSourceFiles,
      rules: {
        "new-cap": [LINT_SEVERITY.ERROR, cloudflareNewCapExceptions],
      },
    },
    {
      files: ["infra/github/**", "infra/wiki-publisher/**"],
      rules: {
        "new-cap": [
          LINT_SEVERITY.ERROR,
          {
            capIsNewExceptionPattern: "^(?:Schema|GitHub)\\.",
            capIsNewExceptions: ["GitHubApp", "Resource", "Stack"],
          },
        ],
      },
    },
    {
      files: ["libs/vite-config/src/features/vite-config/elysia-aot.ts"],
      rules: {
        "max-lines": LINT_SEVERITY.OFF,
        "project/effect-stack": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/vite-config/src/features/vite-config/cloudflare-workers-loader.ts"],
      rules: {
        "max-params": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/vite-config/src/features/vite-config/cloudflare-workers-stub.mjs",
        "libs/vite-config/src/features/vite-config/cloudflare-workflows-stub.mjs",
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
      files: ["libs/auth/src/features/auth/request-hooks.ts"],
      rules: {
        "dont-review-it/no-reassign--use-spread-or-iife": LINT_SEVERITY.OFF,
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/auth/src/features/auth/auth-request.ts",
        "libs/auth/src/features/auth/auth-test-fixture.ts",
        "libs/auth/src/features/auth/browser-client-test-fixture.ts",
        "libs/auth/src/features/auth/email-change-test-fixture.ts",
        "libs/auth/src/features/auth/email-change.worker.test.ts",
        "libs/auth/src/features/auth/wiki-oauth-test-fixture.ts",
      ],
      rules: {
        "typescript/prefer-readonly-parameter-types": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/auth/src/features/auth/auth-request.ts",
        "libs/auth/src/features/auth/browser-client-test-fixture.ts",
        "libs/auth/src/features/auth/session.ts",
        "libs/auth/src/features/auth/session-token.ts",
      ],
      rules: {
        "eslint/max-statements": LINT_SEVERITY.OFF,
        "eslint/max-nested-callbacks": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/auth/src/features/auth/create-auth.ts", "libs/auth/src/features/auth/email.ts"],
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
        "tools/dont-review-it/src/features/dont-review-it/lint-rule-authoring/**",
      ],
      rules: {
        "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["tools/dont-review-it/src/features/dont-review-it/lint/oxlint/**"],
      rules: {
        "typescript/switch-exhaustiveness-check": [
          LINT_SEVERITY.ERROR,
          { considerDefaultExhaustiveForUnions: true },
        ],
      },
    },

    {
      files: ["libs/db/src/features/db/local-platform.test.ts"],
      rules: {
        "dont-review-it/no-detached-test-file--move-beside-source": LINT_SEVERITY.OFF,
        "dont-review-it/require-it-only-expect--move-setup-into-fixture": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/db/src/features/db/database-test-fixture.ts",
        "libs/monitor/src/features/monitor/monitor-test-fixture.ts",
      ],
      rules: {
        "dont-review-it/no-explanatory-comment--delete-or-move-to-commit-message":
          LINT_SEVERITY.OFF,
        "typescript/no-namespace": LINT_SEVERITY.OFF,
        "typescript/triple-slash-reference": LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "libs/auth/src/features/auth/auth.worker.test.ts",
        "libs/auth/src/features/auth/create-auth.worker.test.ts",
        "libs/auth/src/features/auth/email-change.worker.test.ts",
        "libs/auth/src/features/auth/request-hooks.worker.test.ts",
        "libs/auth/src/features/auth/session.worker.test.ts",
        "libs/runtime/src/features/runtime/worker-runtime.dev-server.test.ts",
      ],
      rules: {
        "dont-review-it/no-dry-test-setup--inline-owned-setup": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["libs/db/src/features/db/member-social-schema.ts"],
      rules: {
        "dont-review-it/no-local-finite-value-set--use-or-register-canonical-values":
          LINT_SEVERITY.OFF,
      },
    },
    {
      files: [
        "apps/service-member/src/shared/photo/image-test-fixture.ts",
        "apps/service-member/src/shared/photo/image.ts",
      ],
      rules: {
        "no-bitwise": LINT_SEVERITY.OFF,
      },
    },
    {
      files: ["infra/cloudflare/src/features/cloudflare/**/*.ts"],
      rules: {
        "dont-review-it/no-caller-name-branch--read-the-per-caller-table": [
          LINT_SEVERITY.ERROR,
          { callers: [{ source: "@repo/config", name: "APPLICATION" }] },
        ],
      },
    },
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

export {
  awaitingPresetPackages,
  softPresetPackages,
  generatedFiles,
  lintOptions,
  templateWorkspaces,
};
