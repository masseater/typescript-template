import { APPLICATION } from "@repo/config";
import { appConfig } from "@repo/vite-config";
import { devtools } from "@tanstack/devtools-vite";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => {
  const config = appConfig(APPLICATION.user)(env);
  return {
    ...config,
    plugins: [devtools(), ...(config.plugins ?? [])],
  };
});
