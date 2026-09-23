import { APPLICATION } from "@repo/config";
import { appConfig, paraglideAppPlugin, paraglideAppRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
  ...appConfig(APPLICATION.user, [paraglideAppPlugin()])(env),
  run: paraglideAppRun,
}));
