import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreDependencies: ["vite", "vitest"],
  workspaces: {
    ".": {
      project: ["*.ts", "tools/quality/**/*.{ts,mjs}"],
      ignoreDependencies: ["@effect/tsgo", "@effect/language-service", "effect-tsgo"],
    },
    "apps/*": {
      project: ["src/**/*.{ts,tsx}!"],
      ignoreDependencies: ["cloudflare"],
    },
    "apps/wiki": {
      project: ["src/**/*.{ts,tsx}!", "src/**/*.css"],
      ignoreDependencies: ["cloudflare"],
    },
    "libs/db": {
      entry: ["src/bootstrap-local.ts!", "src/migrate-local.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/cloudflare": {
      entry: [
        "src/settings.ts!",
        "src/database.ts!",
        "src/tokens.ts!",
        "src/budget-monitor.ts!",
        "src/error-monitor.ts!",
        "src/health-monitor.ts!",
        "src/user.ts!",
        "src/admin.ts!",
        "src/wiki.ts!",
        "src/runtime-probe.ts!",
        "src/cli.ts!",
        "src/check-artifacts.ts!",
        "src/engine-check.ts!",
        "src/database-command.ts!",
      ],
      project: ["src/**/*.ts!"],
    },
    "infra/bootstrap": {
      entry: ["src/index.ts!", "src/setup.ts!", "src/run.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/local": { entry: ["src/compose.ts!"], project: ["src/**/*.ts!"] },
    "tools/dev": {
      entry: ["src/cli.ts!", "src/gateway.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
      project: ["src/**/*.ts!"],
    },
    "tools/observe": {
      entry: ["src/cli.ts!", "src/verify.ts!", "src/symbolicate.ts!"],
      project: ["src/**/*.ts!"],
    },
    "infra/budget-monitor": {
      entry: ["src/worker.ts!", "src/inspect.ts!"],
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
  },
};

export default config;
