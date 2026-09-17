import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { previewDevVars } from "@template/config/vite";
import { workerCompatibility } from "@template/config/worker";
import { defineConfig } from "vite-plus";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    previewDevVars(fileURLToPath(new URL(".", import.meta.url))),
    cloudflare({
      config: {
        name: "template-wiki",
        main: "./src/server.ts",
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
      },
      viteEnvironment: { name: "ssr" },
      inspectorPort: false,
    }),
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
  server: { host: "127.0.0.1", port: 3003, strictPort: true, allowedHosts: [".ts.net"] },
  preview: { host: "127.0.0.1", port: 3003, strictPort: true, allowedHosts: [".ts.net"] },
  build: { sourcemap: "hidden" },
}));
