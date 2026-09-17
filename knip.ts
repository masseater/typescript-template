import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: ["vite", "vitest"],
  workspaces: {
    ".": {
      ignoreDependencies: ["@effect/tsgo", "@effect/language-service", "effect-tsgo"],
      project: ["*.ts", "tools/quality/**/*.{ts,mjs}"],
    },
    "apps/*": {
      ignoreDependencies: ["cloudflare"],
      project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
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
        "src/database-command.ts!",
      ],
      project: ["src/**/*.ts!"],
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
    "tools/dev": {
      entry: ["src/cli.ts!", "src/gateway.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
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
