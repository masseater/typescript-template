import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: ["vite", "vitest"],
  workspaces: {
    ".": {
      project: ["*.ts", "tools/quality/**/*.{ts,mjs}"],
    },
    "apps/*": {
      project: ["src/**/*.{ts,tsx}!"],
    },
    "apps/wiki": {
      project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
    },
    "infra/bootstrap": {
      entry: ["src/index.ts!", "src/setup.ts!", "src/run.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/budget-monitor": {
      entry: ["src/worker.ts!", "src/inspect.ts!"],
      ignoreDependencies: ["cloudflare"],
      project: ["src/**/*.ts!"],
    },
    "infra/cloudflare": {
      entry: [
        "src/shared.ts!",
        "src/user.ts!",
        "src/admin.ts!",
        "src/wiki.ts!",
        "src/runtime-probe.ts!",
        "src/cli.ts!",
        "src/check-artifacts.ts!",
        "src/engine-check.ts!",
        "src/database.ts!",
      ],
      project: ["src/**/*.ts!"],
    },
    "infra/error-monitor": {
      entry: ["src/worker.ts!"],
      ignoreDependencies: ["cloudflare"],
      project: ["src/**/*.ts!"],
    },
    "infra/health-monitor": {
      entry: ["src/worker.ts!"],
      ignoreDependencies: ["cloudflare"],
      project: ["src/**/*.ts!"],
    },
    "infra/local": { entry: ["src/compose.ts!"], project: ["src/**/*.ts!"] },
    "libs/auth": {
      project: ["src/**/*.ts!", "!src/auth-test-fixture.ts!", "!src/browser-client.ts!"],
    },
    "libs/db": {
      entry: ["src/bootstrap-local.ts!", "src/migrate-local.ts!", "src/remote-cli.ts!"],
      project: ["src/**/*.ts!"],
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
