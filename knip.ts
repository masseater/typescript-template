import type { KnipConfig } from "knip";

const application = {
  ignoreDependencies: ["cloudflare"],
  project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
};

const config: KnipConfig = {
  ignoreDependencies: ["vite", "vitest"],
  workspaces: {
    ".": {
      ignoreDependencies: [
        "@effect/tsgo",
        "@effect/language-service",
        "@swc/core",
        "effect-tsgo",
        "steiger",
      ],
      project: ["*.ts", "tools/quality/**/*.{ts,mjs}"],
    },
    "apps/*": application,
    "apps/user": {
      ...application,
      entry: ["src/app/server.ts!", "src/app/router.tsx!", "src/app/routes/**/*.tsx!"],
      ignore: ["src/app/routeTree.gen.ts"],
    },
    "infra/budget-monitor": {
      entry: ["src/worker.ts!", "src/inspect.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/cloudflare": {
      entry: [
        "src/database.ts!",
        "src/tokens.ts!",
        "src/budget-monitor.ts!",
        "src/error-monitor.ts!",
        "src/health-monitor.ts!",
        "src/user.ts!",
        "src/admin.ts!",
        "src/wiki.ts!",
        "src/cli.ts!",
        "src/check-artifacts.ts!",
        "src/check-stacks.ts!",
        "src/check-account.ts!",
        "src/bindings.ts!",
        "src/database-command.ts!",
      ],
      ignoreExportsUsedInFile: true,
      project: ["src/**/*.ts!", "!src/verification-fixture.ts!"],
    },
    "infra/error-monitor": {
      entry: ["src/worker.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/health-monitor": {
      entry: ["src/worker.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/local": { entry: ["src/compose.ts!"], project: ["src/**/*.ts!"] },
    "libs/auth": {
      project: [
        "src/**/*.ts!",
        "!src/auth-test-fixture.ts!",
        "!src/browser-client.ts!",
        "!src/mail-fixture.ts!",
        "!src/wiki-oauth-fixture.ts!",
      ],
    },
    "libs/db": {
      entry: ["src/bootstrap-local.ts!", "src/migrate-local.ts!"],
      project: ["src/**/*.ts!", "!src/records-fixture.ts!"],
    },
    "libs/ui": {
      project: [
        "src/**/*.{ts,tsx}!",
        ".storybook/*.ts",
        "!src/story-fixture.ts!",
        "!src/**/*.stories.tsx!",
      ],
    },
    "tools/dev": {
      entry: ["src/cli.ts!", "src/gateway.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
      ignoreDependencies: ["playwright"],
      project: ["src/**/*.ts!"],
    },
    "tools/observe": {
      entry: ["src/cli.ts!", "src/verify.ts!", "src/symbolicate.ts!"],
      project: ["src/**/*.ts!"],
    },
  },
};

// oxlint-disable-next-line import/no-default-export
export default config;
