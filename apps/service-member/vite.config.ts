import { APPLICATION } from "@repo/config";
import { appConfig, paraglideAppPlugin } from "@repo/vite-config";
import { devtools } from "@tanstack/devtools-vite";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => {
  const config = appConfig(APPLICATION.user, [paraglideAppPlugin()])(env);
  return {
    ...config,
    plugins: [devtools(), ...(config.plugins ?? [])],
  };
});
