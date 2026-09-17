import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { previewDevVars } from "@template/config/vite";
import { workerCompatibility } from "@template/config/worker";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@template/dev-boundary";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    previewDevVars(fileURLToPath(new URL(".", import.meta.url))),
    devBoundary("admin"),
    cloudflare({
      config: {
        name: "template-admin",
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
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  server: { host: "127.0.0.1", port: 3002, strictPort: true, allowedHosts: [".local"] },
  preview: { host: "127.0.0.1", port: 3002, strictPort: true, allowedHosts: [".local"] },
  build: { sourcemap: "hidden" },
}));
