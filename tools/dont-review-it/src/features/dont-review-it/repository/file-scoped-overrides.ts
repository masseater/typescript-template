import { recommended as effectRecommended } from "@effect/tsgo/oxlint-presets";

import { LINT_SEVERITY } from "../lint-rule-authoring/index.ts";
import { reactElementTypeFiles } from "./ui-lint-settings.ts";

import type { OxlintConfig } from "oxlint";

const midPresetEffectPackages = ["libs/db/**", "libs/runtime/**", "libs/observability/**"];

const midPresetEffectRules = Object.fromEntries(
  Object.keys(effectRecommended.rules ?? {}).map((ruleName) => [ruleName, LINT_SEVERITY.OFF]),
);

const authUiServerReadsAwaitingQuery = [
  "libs/auth-ui/src/features/auth-ui/email-change-confirmation.tsx",
  "libs/auth-ui/src/features/auth-ui/email-change-verification.tsx",
  "libs/auth-ui/src/features/auth-ui/email-verification.tsx",
  "libs/auth-ui/src/features/auth-ui/use-passkeys.ts",
  "libs/auth-ui/src/features/auth-ui/use-session.ts",
];

const fileScopedOverrides = [
  {
    files: ["libs/runtime/src/features/runtime/worker.ts"],
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
      "dont-review-it/require-test-block-for-spec-file--add-test-or-delete-file": LINT_SEVERITY.OFF,
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
          capIsNewExceptionPattern: "^(?:Schema|Context|Data|Config|Binding|D1|Email|WorkersAi)\\.",
        },
      ],
      "typescript/explicit-function-return-type": LINT_SEVERITY.OFF,
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
      "dont-review-it/no-explanatory-comment--delete-or-move-to-commit-message": LINT_SEVERITY.OFF,
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
] satisfies NonNullable<OxlintConfig["overrides"]>;

export { fileScopedOverrides };
