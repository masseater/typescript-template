import { APPLICATION } from "@repo/config";
import { appConfig, paraglideAppPlugin, paraglideAppRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
  ...appConfig(APPLICATION.admin, { plugins: [paraglideAppPlugin()] })(env),
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
