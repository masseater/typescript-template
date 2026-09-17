import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { devBoundary } from "@template/dev-boundary";
import { defineConfig } from "vite-plus";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    devBoundary("wiki"),
    cloudflare({
      ...(command === "serve" && !isPreview
        ? { config: { assets: { binding: "ASSETS", run_worker_first: false } } }
        : {}),
      viteEnvironment: { name: "ssr" },
      persistState: { path: fileURLToPath(new URL("../../.local/d1", import.meta.url)) },
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
