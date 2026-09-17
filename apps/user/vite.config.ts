import type { ConfigEnv, UserConfig } from "vite-plus";
import { appRun, appServer, previewDevVars, withoutEnvFileLoader } from "@template/config/vite";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@template/dev-boundary";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { workerCompatibility } from "@template/config/worker";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    previewDevVars(import.meta.dirname),
    devBoundary("user"),
    cloudflare({
      config: {
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        d1_databases: [localDatabase],
        main: "./src/server.ts",
        name: "template-user",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    ...withoutEnvFileLoader(tanstackStart()),
    react(),
  ],
  preview: appServer("user"),
  run: appRun,
  server: appServer("user"),
}));
