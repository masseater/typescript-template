import type { KnipConfig, KnipConfiguration } from "knip";

const application = {
  entry: ["src/app/{router,server,start}.{ts,tsx}!", "src/app/routes/**/*.{ts,tsx}!"],
  ignoreDependencies: ["cloudflare"],
  project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
};

const load = {
  entry: ["scenarios/*.ts!"],
  ignoreDependencies: ["k6"],
  project: ["src/**/*.ts!", "scenarios/**/*.ts!"],
};
const loadCommands = ["src/cli.ts!"];

const workspaces = {
  ".": {
    entry: ["doctor.config.ts"],
    ignoreDependencies: ["@effect/tsgo", "@effect/language-service", "effect-tsgo"],
    project: ["*.{js,ts}", "tools/quality/**/*.{ts,mjs}"],
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
    project: [
      "src/**/*.ts!",
      "!src/auth-test-fixture.ts!",
      "!src/browser-client.ts!",
      "!src/mail-fixture.ts!",
      "!src/wiki-oauth-fixture.ts!",
    ],
  },
  "libs/monitor": {
    ignoreDependencies: ["cloudflare"],
    project: ["src/**/*.ts!", "!src/monitor-fixture.ts!", "!src/mail-recorder.ts!"],
  },
  "libs/ui": {
    project: ["src/**/*.{ts,tsx}!", "src/**/*.css", ".storybook/*.ts", "!src/**/*.stories.tsx!"],
  },
};

const cloudflareStacks = [
  "src/database.ts!",
  "src/tokens.ts!",
  "src/budget-monitor.ts!",
  "src/error-monitor.ts!",
  "src/health-monitor.ts!",
  "src/user.ts!",
  "src/admin.ts!",
  "src/wiki.ts!",
  "src/bindings.ts!",
];

const scripts = {
  "infra/budget-monitor": ["src/inspect.ts!"],
  "infra/cloudflare": [
    "src/cli.ts!",
    "src/check-artifacts.ts!",
    "src/check-stacks.ts!",
    "src/check-account.ts!",
    "src/bootstrap-state.ts!",
    "src/database-command.ts!",
  ],
  "infra/local": ["src/compose.ts!"],
  "libs/db": ["src/bootstrap-local.ts!", "src/migrate-local.ts!"],
  "tools/dev": ["src/cli.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
  "tools/observe": ["src/cli.ts!", "src/verify.ts!", "src/symbolicate.ts!"],
};

function config({
  production = false,
  strict = false,
}: Readonly<
  Pick<Parameters<Extract<KnipConfig, (options: never) => unknown>>[0], "production" | "strict">
>): KnipConfiguration {
  function productionOnly(...files: readonly string[]): string[] {
    return production || strict ? [...files] : [];
  }
  const app = { ...application, ignore: productionOnly("src/app/routeTree.gen.ts") };
  return {
    ignoreDependencies: ["vite", "vitest"],
    treatConfigHintsAsErrors: true,
    workspaces: {
      ...workspaces,
      "apps/*": app,
      "apps/wiki": { ...app, project: ["src/**/*.{ts,tsx,mdx}!", "src/**/*.css"] },
      "infra/budget-monitor": {
        entry: ["src/worker.ts!", ...productionOnly(...scripts["infra/budget-monitor"])],
        project: ["src/**/*.ts!"],
      },
      "infra/cloudflare": {
        entry: [...cloudflareStacks, ...productionOnly(...scripts["infra/cloudflare"])],
        ignoreExportsUsedInFile: true,
        project: ["src/**/*.ts!", "!src/account-fixture.ts!"],
      },
      "infra/local": {
        entry: productionOnly(...scripts["infra/local"]),
        project: ["src/**/*.ts!"],
      },
      "libs/db": {
        entry: ["src/testing-node.ts!", ...productionOnly(...scripts["libs/db"])],
        ignoreDependencies: ["cloudflare"],
        project: ["src/**/*.ts!", "!src/records-fixture.ts!"],
      },
      "tools/dev": {
        entry: ["src/gateway.ts!", ...productionOnly(...scripts["tools/dev"])],
        ignoreDependencies: ["playwright"],
        project: ["src/**/*.ts!"],
      },
      "tools/load": { ...load, entry: [...load.entry, ...productionOnly(...loadCommands)] },
      "tools/observe": {
        entry: productionOnly(...scripts["tools/observe"]),
        project: ["src/**/*.ts!"],
      },
    },
  };
}

// oxlint-disable-next-line import/no-default-export
export default config satisfies KnipConfig;
