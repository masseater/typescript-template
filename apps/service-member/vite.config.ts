import { APPLICATION } from "@repo/config";
import { appConfig, paraglideAppPlugin, paraglideAppRun } from "@repo/vite-config";
import { devtools } from "@tanstack/devtools-vite";
import { defineConfig } from "vite-plus";

import type { UserConfig } from "vite-plus";

const withDevtools = (config: UserConfig): UserConfig => ({
  ...config,
  plugins: [devtools(), ...(config.plugins ?? [])],
});

export default defineConfig((env) => ({
  ...withDevtools(appConfig(APPLICATION.user, { plugins: [paraglideAppPlugin()] })(env)),
  run: paraglideAppRun(import.meta.dirname),
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
}));
