import type { KnipConfig, KnipConfiguration } from "knip";

const load = {
  entry: ["scenarios/*.ts!"],
  ignoreDependencies: ["k6"],
  project: ["src/**/*.ts!", "scenarios/**/*.ts!"],
};
const loadCommands = ["src/features/load/cli.ts!", "src/features/load/ci.ts!"];

const workspaces = {
  ".": {
    ignoreDependencies: [
      "@effect/language-service",
      "@effect/tsgo",
      "@shadcn/lint",
      "@swc/core",
      "oxlint",
      "oxlint-tsgolint",
      "textlint",
      "textlint-rule-preset-ai-words-ja",
    ],
    project: ["*.{js,ts}"],
    vitest: {
      config: ["vite.config.ts", "vitest.mutation.config.ts"],
      entry: ["vitest.workers.main.ts"],
    },
  },
  "infra/error-monitor": {
    entry: ["src/features/error-monitor/worker.ts!"],
    project: ["src/**/*.ts!"],
  },
  "infra/health-monitor": {
    entry: ["src/features/health-monitor/worker.ts!"],
    project: ["src/**/*.ts!"],
  },
  "libs/auth": {
    entry: [
      "src/features/auth/auth-test-fixture.ts",
      "src/features/auth/browser-client.ts",
      "src/features/auth/mail-fixture.ts",
      "src/features/auth/testing.ts",
      "src/features/auth/unexpected-status.ts",
      "src/features/auth/wiki-oauth-fixture.ts",
    ],
    project: ["src/**/*.ts!"],
  },
  "libs/feature-flags": {
    project: ["src/**/*.ts!"],
  },
  "libs/monitor": {
    entry: ["src/features/monitor/mail-recorder.ts", "src/features/monitor/monitor-fixture.ts"],
    project: ["src/**/*.ts!"],
  },
  "libs/observability": {
    entry: ["src/features/observability/browser-testing.ts", "src/features/observability/server-testing.ts"],
  },
  "libs/runtime": {
    entry: ["src/features/runtime/*-fixture.ts"],
    project: ["src/**/*.ts!"],
  },
  "libs/auth-ui": {
    project: ["src/**/*.{ts,tsx}!", "!src/**/*.stories.tsx!"],
    storybook: { entry: ["src/**/*.stories.tsx"] },
  },
  "libs/ui": {
    entry: ["*.test.ts"],
    project: [
      "src/**/*.{ts,tsx}!",
      "src/**/*.css",
      "storybook/*.ts",
      "!src/**/*.stories.tsx!",
      "*.{ts,tsx}",
    ],
    storybook: {
      config: ["storybook/{main,test-runner}.{js,mjs,ts}"],
      entry: ["storybook/{manager,preview,preview-head,preview-body}.{js,jsx,mjs,ts,tsx}"],
    },
  },
  "tools/ai-native": {
    ignoreDependencies: ["@tanstack/intent"],
  },
  "tools/ai-native-telemetry": { ignoreDependencies: ["@tanstack/intent"] },
  "tools/dont-review-it": {
    entry: [
      "src/features/dont-review-it/repository/dependency-cruiser.ts",
      "doctor.config.ts",
      "src/features/dont-review-it/index.ts!",
      "src/features/dont-review-it/repository/lint.ts!",
      "src/features/dont-review-it/repository/plugin.ts!",
    ],
    ignoreDependencies: ["@tanstack/intent", "@repo/config!", "@repo/observability!", "effect!"],
    project: [
      "src/features/dont-review-it/repository/**/*.{ts,mjs}",
      "src/**/*.{ts,mjs}!",
      "*.ts",
      "!src/features/dont-review-it/vitest/parsed-fields.ts!",
    ],
  },
  "tools/e2e": {
    entry: ["src/**/*.test.ts"],
    project: ["src/**/*.ts"],
  },
};

const cloudflareStacks = [
  "src/features/cloudflare/database.ts!",
  "src/features/cloudflare/flagship.ts!",
  "src/features/cloudflare/email.ts!",
  "src/features/cloudflare/observability.ts!",
  "src/features/cloudflare/tokens.ts!",
  "src/features/cloudflare/budget-monitor.ts!",
  "src/features/cloudflare/error-monitor.ts!",
  "src/features/cloudflare/health-monitor.ts!",
  "src/features/cloudflare/storage.ts!",
  "src/features/cloudflare/zone.ts!",
  "src/features/cloudflare/bindings.ts!",
  "src/features/cloudflare/stack-entrypoints.ts!",
];

const application = {
  entry: ["src/app/{router,server,start}.{ts,tsx}!", "src/app/routes/**/*.{ts,tsx}!"],
  ignoreDependencies: ["steiger"],
  project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
};

const scripts = {
  "infra/budget-monitor": ["src/features/budget-monitor/inspect.ts!"],
  "infra/cloudflare": [
    "src/features/cloudflare/cli.ts!",
    "src/features/cloudflare/check-stacks.ts!",
    "src/features/cloudflare/check-account.ts!",
    "src/features/cloudflare/bootstrap-state.ts!",
    "src/features/cloudflare/database-command.ts!",
    "src/features/cloudflare/prepare-ci-env.ts!",
    "src/features/cloudflare/verify-origins.ts!",
  ],
  "infra/local": ["src/features/local/compose.ts!"],
  "libs/db-local": ["src/features/db-local/bootstrap-local.ts!", "src/features/db-local/migrate-local.ts!"],
  "libs/vite-config": ["src/features/vite-config/compile-paraglide.ts!", "src/features/vite-config/compile-workspace-paraglide.ts!"],
  "tools/dev": [
    "src/features/dev/cli.ts!",
    "src/features/dev/prepare-browser.ts!",
    "src/features/dev/dev-start.ts!",
    "src/features/dev/observe/cli.ts!",
    "src/features/dev/observe/verify.ts!",
    "src/features/dev/observe/symbolicate.ts!",
    "src/features/dev/observe/receiver-check.ts!",
  ],
};

const config = ({
  production = false,
  strict = false,
}: Readonly<
  Pick<Parameters<Extract<KnipConfig, (options: never) => unknown>>[0], "production" | "strict">
>): KnipConfiguration => {
  const productionOnly = (...files: readonly string[]): string[] =>
    production || strict ? [...files] : [];
  const app = {
    ...application,
    ignore: productionOnly("src/app/routeTree.gen.ts", ".paraglide/**"),
  };
  return {
    ignoreDependencies: ["vite"],
    ignoreIssues: {
      "apps/internal-dashboard/src/shared/server-api/flags-api.ts": ["unlisted"],
      "apps/internal-dashboard/src/shared/server-api/runtime.ts": ["unlisted"],
      "apps/internal-dashboard/src/shared/server-api/server-app.ts": ["exports"],
      "apps/internal-dashboard/src/shared/wiki/wiki-layer.worker.test.ts": ["unlisted"],
      "apps/service-admin/src/shared/server-api/runtime.ts": ["unlisted"],
      "apps/service-admin/src/shared/server-api/server-app.ts": ["exports"],
      "apps/service-member/src/shared/server-api/board-api.worker.test.ts": ["unlisted"],
      "apps/service-member/src/shared/server-api/contact-api.worker.test.ts": ["unlisted"],
      "apps/service-member/src/shared/inbox/binding.ts": ["exports"],
      "apps/service-member/src/shared/inbox/client.ts": ["exports"],
      "apps/service-member/src/shared/inbox/inbox.ts": ["types"],
      "apps/service-member/src/shared/inbox/inbox.worker.test.ts": ["unlisted"],
      "apps/service-member/src/shared/inbox/index.ts": ["exports", "types"],
      "apps/service-member/src/shared/server-api/jobs-api.ts": ["unlisted"],
      "apps/service-member/src/shared/server-api/jobs-api.worker.test.ts": ["unlisted"],
      "apps/service-member/src/shared/server-api/realtime-api.ts": ["unlisted"],
      "apps/service-member/src/shared/server-api/runtime.ts": ["unlisted"],
      "apps/service-member/src/shared/server-api/server-app.ts": ["exports"],
      "libs/db/src/features/db/testing.ts": ["unlisted"],
      "libs/monitor/src/features/monitor/mail-recorder.ts": ["unlisted"],
      "libs/monitor/src/features/monitor/mail-recorder.worker.test.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/app-fixture.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/bindings.worker.test.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/jobs.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/storage.worker.test.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/worker-telemetry.worker.test.ts": ["unlisted"],
      "libs/runtime/src/features/runtime/worker.worker.test.ts": ["unlisted"],
      "libs/ui/storybook/preview.tsx": ["unlisted"],
    },
    treatConfigHintsAsErrors: true,
    workspaces: {
      ...workspaces,
      ".": { ...workspaces["."], ignoreBinaries: productionOnly("stryker", "depcruise") },
      "apps/*": app,
      "apps/core": {
        entry: ["alchemy.run.ts!", "src/features/core/worker.ts!"],
        ignoreDependencies: ["cloudflare"],
        project: ["src/**/*.ts!"],
      },
      "apps/internal-dashboard": {
        ...app,
        entry: ["alchemy.run.ts!", ...application.entry],
        project: [
          "src/**/*.{ts,tsx,mdx}!",
          "src/**/*.css",
          "!src/shared/wiki/wiki-oauth-fixture.ts!",
        ],
      },
      "apps/service-admin": {
        ...app,
        entry: ["alchemy.run.ts!", ...application.entry],
        project: ["src/**/*.{ts,tsx}!"],
      },
      "apps/service-member": {
        ...app,
        entry: ["alchemy.run.ts!", ...application.entry],
        project: ["src/**/*.{ts,tsx}!"],
      },
      "infra/budget-monitor": {
        entry: ["src/features/budget-monitor/worker.ts!", ...productionOnly(...scripts["infra/budget-monitor"])],
        project: ["src/**/*.ts!"],
      },
      "infra/cloudflare": {
        entry: [
          ...cloudflareStacks,
          ...productionOnly(...scripts["infra/cloudflare"]),
          "src/features/cloudflare/account-fixture.ts",
          "src/features/cloudflare/inspection-fixture.ts",
        ],
        ignoreExportsUsedInFile: true,
        project: ["src/**/*.ts!"],
      },
      "infra/local": {
        entry: productionOnly(...scripts["infra/local"]),
        project: ["src/**/*.ts!"],
      },
      "libs/db": {
        entry: ["src/features/db/records-fixture.ts"],
        project: ["src/**/*.ts!"],
      },
      "libs/db-local": {
        entry: productionOnly(...scripts["libs/db-local"]),
        project: ["src/**/*.ts!"],
      },
      "libs/vite-config": {
        entry: [
          "src/features/vite-config/cloudflare-workers-loader.ts",
          "src/features/vite-config/cloudflare-workers-stub.mjs",
          "src/features/vite-config/cloudflare-workflows-stub.mjs",
          ...productionOnly(...scripts["libs/vite-config"]),
        ],
      },
      "tools/dev": {
        entry: ["src/features/dev/gateway.ts!", ...productionOnly(...scripts["tools/dev"])],
        ignoreDependencies: ["agent-browser", "playwright"],
        project: ["src/**/*.ts!"],
      },
      "tools/load": {
        ...load,
        entry: [...load.entry, ...productionOnly(...loadCommands)],
        ignoreBinaries: productionOnly("vp"),
      },
    },
  };
};

export default config satisfies KnipConfig;
