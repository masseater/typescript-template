import type { ConfigEnv, UserConfig } from "vite-plus";
import { localDatabase, localDatabasePersistence } from "@template/db/local";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@template/dev-boundary";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { previewDevVars } from "@template/config/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { workerCompatibility } from "@template/config/worker";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    previewDevVars(import.meta.dirname),
    devBoundary("wiki"),
    cloudflare({
      config: {
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        d1_databases: [localDatabase],
        main: "./src/server.ts",
        name: "template-wiki",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  preview: { allowedHosts: [".local"], host: "127.0.0.1", port: 3003, strictPort: true },
  server: { allowedHosts: [".local"], host: "127.0.0.1", port: 3003, strictPort: true },
}));
