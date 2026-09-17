import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { applicationPorts } from "@template/config";
import { previewDevVars } from "@template/config/vite";
import { workerCompatibility } from "@template/config/worker";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@template/dev-boundary";

const server = {
  host: "127.0.0.1",
  port: applicationPorts.user,
  strictPort: true,
  allowedHosts: [".local"],
};

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    previewDevVars(fileURLToPath(new URL(".", import.meta.url))),
    devBoundary("user"),
    cloudflare({
      config: {
        name: "template-user",
        main: "./src/server.ts",
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        d1_databases: [localDatabase],
      },
      viteEnvironment: { name: "ssr" },
      persistState: { path: localDatabasePersistence },
      inspectorPort: false,
    }),
    tanstackStart(),
    react(),
  ],
  server,
  preview: server,
  build: { sourcemap: "hidden" },
}));
