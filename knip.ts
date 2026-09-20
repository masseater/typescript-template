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
      "@effect/tsgo",
      "@effect/language-service",
      "@shadcn/lint",
      "@swc/core",
      "dependency-cruiser",
    ],
    project: ["*.{js,ts}"],
    vitest: { config: ["vite.config.ts", "vitest.mutation.config.ts"] },
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
    entry: ["src/auth-test-fixture.ts", "src/browser-client.ts", "src/mail-fixture.ts"],
    project: ["src/**/*.ts!"],
  },
  "libs/monitor": {
    ignoreDependencies: ["cloudflare"],
    entry: ["src/mail-recorder.ts"],
    project: ["src/**/*.ts!"],
  },
  "libs/runtime": {
    ignoreDependencies: ["cloudflare"],
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
    ignoreBinaries: ["mkfifo"],
    ignoreDependencies: ["@tanstack/intent"],
  },
  "tools/ai-native-telemetry": { ignoreDependencies: ["@tanstack/intent"] },
  "tools/dont-review-it": {
    entry: ["src/repository/dependency-cruiser.ts", "doctor.config.ts"],
    ignoreDependencies: ["@tanstack/intent", "@repo/config!", "@repo/observability!", "effect!"],
    project: ["src/repository/**/*.{ts,mjs}", "src/**/*.{ts,mjs}!", "*.ts"],
  },
  "tools/e2e": {
    entry: ["src/**/*.test.ts"],
    project: ["src/**/*.ts"],
  },
};

const cloudflareStacks = [
  "src/database.ts!",
  "src/email.ts!",
  "src/observability.ts!",
  "src/tokens.ts!",
  "src/budget-monitor.ts!",
  "src/error-monitor.ts!",
  "src/health-monitor.ts!",
  "src/service-member.ts!",
  "src/service-admin.ts!",
  "src/internal-dashboard.ts!",
  "src/zone.ts!",
  "src/bindings.ts!",
];

const application = {
  entry: ["src/app/{router,server,start}.{ts,tsx}!", "src/app/routes/**/*.{ts,tsx}!"],
  ignoreDependencies: ["cloudflare", "steiger"],
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
  "tools/commander": ["src/app/cli.ts!", "src/app/check-start.ts!"],
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

const commanderWorkspace = (
  only: (...files: readonly string[]) => string[],
): NonNullable<KnipConfiguration["workspaces"]>[string] => {
  return {
    entry: [...application.entry, ...only(...scripts["tools/commander"])],
    ignoreDependencies: [...only("playwright"), "steiger"],
    ignoreExportsUsedInFile: { interface: true },
  };
};

const config = ({
  production = false,
  strict = false,
}: Readonly<
  Pick<Parameters<Extract<KnipConfig, (options: never) => unknown>>[0], "production" | "strict">
>): KnipConfiguration => {
  const productionOnly = (...files: readonly string[]): string[] =>
    production || strict ? [...files] : [];
  const app = { ...application, ignore: productionOnly("src/app/routeTree.gen.ts") };
  return {
    ignoreDependencies: ["vite", "vitest"],
    ignoreIssues: {
      "libs/ui/storybook/preview.tsx": ["unlisted"],
    },
    treatConfigHintsAsErrors: true,
    workspaces: {
      ...workspaces,
      ".": { ...workspaces["."], ignoreBinaries: productionOnly("stryker") },
      "apps/*": app,
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
        ignoreDependencies: [...application.ignoreDependencies, "tailwindcss"],
      },
      "apps/service-member": {
        ...app,
        ignoreDependencies: [...application.ignoreDependencies, "tailwindcss"],
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
        ignoreDependencies: ["cloudflare"],
        project: ["src/**/*.ts!"],
      },
      "libs/db-local": {
        entry: productionOnly(...scripts["libs/db-local"]),
        project: ["src/**/*.ts!"],
      },
      "tools/commander": { ...app, ...commanderWorkspace(productionOnly) },
      "tools/dev": {
        entry: ["src/gateway.ts!", ...productionOnly(...scripts["tools/dev"])],
        ignoreDependencies: ["playwright"],
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
