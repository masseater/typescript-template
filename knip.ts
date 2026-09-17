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
    "libs/db": {
      entry: ["src/bootstrap-local.ts!", "src/migrate-local.ts!", "src/remote-cli.ts!"],
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
      ignoreDependencies: ["cloudflare"],
    },
    "infra/error-monitor": {
      entry: ["src/worker.ts!"],
      project: ["src/**/*.ts!"],
      ignoreDependencies: ["cloudflare"],
    },
    "tools/e2e": {
      project: ["src/**/*.ts"],
    },
  },
};

export default config;
