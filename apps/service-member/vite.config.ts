import { APPLICATION } from "@repo/config";
import { appConfig, paraglideAppPlugin, paraglideAppRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig(APPLICATION.user, [paraglideAppPlugin()], paraglideAppRun));
