import type { KnipConfig } from "knip";

const config: KnipConfig = {
  ignoreBinaries: ["fish"],
  workspaces: {
    ".": {
      entry: ["vite.config.ts", "knip.ts", "tools/quality/rules.ts", "tools/quality/**/*.test.ts"],
      project: ["*.ts", "tools/quality/**/*.{ts,mjs}"],
    },
    "apps/*": {
      entry: ["vite.config.ts", "src/router.tsx!", "src/server.ts!", "src/**/*.test.ts"],
      project: ["vite.config.ts", "src/**/*.{ts,tsx}!"],
    },
    "libs/db": {
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
    "tools/dev": {
      entry: ["src/cli.ts!", "src/prepare-browser.ts!", "src/private-maps.ts!"],
      project: ["src/**/*.ts!"],
    },
    "tools/observe": {
      entry: ["src/cli.ts!", "src/verify.ts!", "src/**/*.test.ts"],
      project: ["src/**/*.ts!"],
    },
    "infra/budget-monitor": {
      entry: ["src/worker.ts!", "src/inspect.ts!", "src/**/*.test.ts"],
      project: ["src/**/*.ts!"],
      ignoreDependencies: ["cloudflare"],
    },
    "tools/e2e": {
      entry: ["e2e.config.ts", "src/**/*.test.ts"],
      project: ["src/**/*.ts", "e2e.config.ts"],
    },
  },
};

export default config;
