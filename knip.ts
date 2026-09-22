import type { KnipConfig, KnipConfiguration } from "knip";

const load = {
  entry: ["scenarios/*.ts!"],
  ignoreDependencies: ["k6"],
  project: ["src/**/*.ts!", "scenarios/**/*.ts!"],
};
const loadCommands = ["src/cli.ts!", "src/ci.ts!"];

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
    entry: ["src/worker.ts!"],
    project: ["src/**/*.ts!"],
  },
  "infra/health-monitor": {
    entry: ["src/worker.ts!"],
    project: ["src/**/*.ts!"],
  },
  "libs/auth": {
    entry: [
      "src/auth-test-fixture.ts",
      "src/browser-client.ts",
      "src/mail-fixture.ts",
      "src/testing.ts",
      "src/unexpected-status.ts",
      "src/wiki-oauth-fixture.ts",
    ],
    project: ["src/**/*.ts!"],
  },
  "libs/feature-flags": {
    project: ["src/**/*.ts!"],
  },
  "libs/monitor": {
    entry: ["src/mail-recorder.ts", "src/monitor-fixture.ts"],
    project: ["src/**/*.ts!"],
  },
  "libs/observability": {
    entry: ["src/browser-testing.ts", "src/server-testing.ts"],
  },
  "libs/runtime": {
    entry: ["src/*-fixture.ts"],
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
      "src/repository/dependency-cruiser.ts",
      "doctor.config.ts",
      "src/index.ts!",
      "src/repository/lint.ts!",
      "src/repository/plugin.ts!",
    ],
    ignoreDependencies: ["@tanstack/intent", "@repo/config!", "@repo/observability!", "effect!"],
    project: [
      "src/repository/**/*.{ts,mjs}",
      "src/**/*.{ts,mjs}!",
      "*.ts",
      "!src/vitest/parsed-fields.ts!",
    ],
  },
  "tools/e2e": {
    entry: ["src/**/*.test.ts"],
    project: ["src/**/*.ts"],
  },
};

const cloudflareStacks = [
  "src/core.ts!",
  "src/database.ts!",
  "src/flagship.ts!",
  "src/email.ts!",
  "src/observability.ts!",
  "src/tokens.ts!",
  "src/budget-monitor.ts!",
  "src/error-monitor.ts!",
  "src/health-monitor.ts!",
  "src/service-member.ts!",
  "src/service-admin.ts!",
  "src/internal-dashboard.ts!",
  "src/storage.ts!",
  "src/zone.ts!",
  "src/bindings.ts!",
];

const application = {
  entry: ["src/app/{router,server,start}.{ts,tsx}!", "src/app/routes/**/*.{ts,tsx}!"],
  ignoreDependencies: ["steiger"],
  project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
};

const scripts = {
  "infra/budget-monitor": ["src/inspect.ts!"],
  "infra/cloudflare": [
    "src/cli.ts!",
    "src/check-stacks.ts!",
    "src/check-account.ts!",
    "src/bootstrap-state.ts!",
    "src/database-command.ts!",
    "src/prepare-ci-env.ts!",
    "src/verify-origins.ts!",
  ],
  "infra/local": ["src/compose.ts!"],
  "libs/db-local": ["src/bootstrap-local.ts!", "src/migrate-local.ts!"],
  "libs/vite-config": ["src/compile-paraglide.ts!"],
  "tools/dev": [
    "src/cli.ts!",
    "src/prepare-browser.ts!",
    "src/dev-start.ts!",
    "src/observe/cli.ts!",
    "src/observe/verify.ts!",
    "src/observe/symbolicate.ts!",
    "src/observe/receiver-check.ts!",
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
      "libs/db/src/testing.ts": ["unlisted"],
      "libs/monitor/src/mail-recorder.ts": ["unlisted"],
      "libs/monitor/src/mail-recorder.worker.test.ts": ["unlisted"],
      "libs/runtime/src/app-fixture.ts": ["unlisted"],
      "libs/runtime/src/bindings.worker.test.ts": ["unlisted"],
      "libs/runtime/src/jobs.ts": ["unlisted"],
      "libs/runtime/src/storage.worker.test.ts": ["unlisted"],
      "libs/runtime/src/worker-telemetry.worker.test.ts": ["unlisted"],
      "libs/runtime/src/worker.worker.test.ts": ["unlisted"],
      "libs/ui/storybook/preview.tsx": ["unlisted"],
    },
    treatConfigHintsAsErrors: true,
    workspaces: {
      ...workspaces,
      ".": { ...workspaces["."], ignoreBinaries: productionOnly("stryker", "depcruise") },
      "apps/*": app,
      "apps/core": {
        entry: ["src/worker.ts!"],
        ignoreDependencies: ["cloudflare"],
        project: ["src/**/*.ts!"],
      },
      "apps/internal-dashboard": {
        ...app,
        project: [
          "src/**/*.{ts,tsx,mdx}!",
          "src/**/*.css",
          "!src/shared/wiki/wiki-oauth-fixture.ts!",
        ],
      },
      "apps/service-admin": {
        ...app,
        project: ["src/**/*.{ts,tsx}!"],
      },
      "apps/service-member": {
        ...app,
        project: ["src/**/*.{ts,tsx}!"],
      },
      "infra/budget-monitor": {
        entry: ["src/worker.ts!", ...productionOnly(...scripts["infra/budget-monitor"])],
        project: ["src/**/*.ts!"],
      },
      "infra/cloudflare": {
        entry: [
          ...cloudflareStacks,
          ...productionOnly(...scripts["infra/cloudflare"]),
          "src/account-fixture.ts",
          "src/inspection-fixture.ts",
        ],
        ignoreExportsUsedInFile: true,
        project: ["src/**/*.ts!"],
      },
      "infra/local": {
        entry: productionOnly(...scripts["infra/local"]),
        project: ["src/**/*.ts!"],
      },
      "libs/db": {
        entry: ["src/records-fixture.ts"],
        project: ["src/**/*.ts!"],
      },
      "libs/db-local": {
        entry: productionOnly(...scripts["libs/db-local"]),
        project: ["src/**/*.ts!"],
      },
      "libs/vite-config": {
        entry: [
          "src/cloudflare-workers-loader.mjs",
          "src/cloudflare-workers-stub.mjs",
          "src/cloudflare-workflows-stub.mjs",
          ...productionOnly(...scripts["libs/vite-config"]),
        ],
      },
      "tools/dev": {
        entry: ["src/gateway.ts!", ...productionOnly(...scripts["tools/dev"])],
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
