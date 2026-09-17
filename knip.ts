import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreBinaries: ["fish"],
  workspaces: {
    ".": {
      entry: [
        "vite.config.ts",
        "knip.ts",
        "internal/quality/rules.ts",
        "internal/quality/**/*.test.ts",
      ],
      project: ["*.ts", "internal/quality/**/*.{ts,mjs}"],
    },
    "apps/*": {
      entry: ["vite.config.ts", "src/router.tsx!", "src/server.ts!", "src/**/*.test.ts"],
      project: ["vite.config.ts", "src/**/*.{ts,tsx}!"],
    },
    "packages/db": {
      entry: [
        "src/bootstrap-local.ts!",
        "src/remote-cli.ts!",
        "src/**/*.test.ts",
        "drizzle.config.ts",
      ],
      project: ["src/**/*.ts!", "drizzle.config.ts"],
    },
    "infra/cloudflare": {
      entry: [
        "src/shared.ts!",
        "src/user.ts!",
        "src/admin.ts!",
        "src/runtime-probe.ts!",
        "src/cli.ts!",
        "src/check-artifacts.ts!",
        "src/engine-check.ts!",
        "src/database.ts!",
        "src/**/*.test.ts",
      ],
      project: ["src/**/*.ts!"],
    },
    "infra/bootstrap": {
      entry: ["src/index.ts!", "src/setup.ts!", "src/run.ts!", "src/**/*.test.ts"],
      project: ["src/**/*.ts!"],
    },
    "infra/local": { entry: ["src/compose.ts!"], project: ["src/**/*.ts!"] },
    "internal/dev": {
      entry: ["src/cli.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
      project: ["src/**/*.ts!"],
    },
    "internal/observability": {
      entry: ["src/cli.ts!", "src/verify.ts!", "src/**/*.test.ts"],
      project: ["src/**/*.ts!"],
    },
    "internal/budget-monitor": {
      entry: ["src/worker.ts!", "src/inspect.ts!", "src/**/*.test.ts"],
      project: ["src/**/*.ts!"],
      ignoreDependencies: ["cloudflare"],
    },
    "internal/e2e": {
      entry: ["e2e.config.ts", "src/**/*.test.ts"],
      project: ["src/**/*.ts", "e2e.config.ts"],
    },
  },
};

export default config;
