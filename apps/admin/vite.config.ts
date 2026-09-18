import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import {
  appRun,
  appServer,
  previewDevVars,
  reactCompiler,
  startOptions,
  withoutEnvFileLoader,
} from "@template/config/vite";
import { workerCompatibility } from "@template/config/worker";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { devBoundary } from "@template/dev-boundary";
import { defineConfig, type ConfigEnv, type UserConfig } from "vite-plus";

export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    previewDevVars(import.meta.dirname),
    devBoundary("admin"),
    cloudflare({
      config: {
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        d1_databases: [localDatabase],
        main: "./src/app/server.ts",
        name: "template-admin",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart(startOptions)),
    reactCompiler(),
  ],
  preview: appServer("admin"),
  run: appRun,
  server: appServer("admin"),
}));
