import type { ConfigEnv, UserConfig } from "vite-plus";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { localRuntimeToolsOnLoopback, previewDevVars } from "@template/config/vite";
import { adminDevAccess } from "./dev-access.ts";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { workerCompatibility } from "@template/config/worker";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    localRuntimeToolsOnLoopback(),
    previewDevVars(import.meta.dirname),
    adminDevAccess(),
    cloudflare({
      config: {
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        d1_databases: [localDatabase],
        main: "./src/server.ts",
        name: "template-admin",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    tanstackStart(),
    react(),
  ],
  preview: { allowedHosts: [".local"], host: "127.0.0.1", port: 3002, strictPort: true },
  server: { allowedHosts: [".local"], host: "127.0.0.1", port: 3002, strictPort: true },
}));
