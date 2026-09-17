import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@template/dev-boundary";

export default defineConfig(({ command, isPreview }) => ({
  plugins: [
    devBoundary("admin"),
    cloudflare({
      ...(command === "serve" && !isPreview
        ? { config: { assets: { binding: "ASSETS", run_worker_first: false } } }
        : {}),
      viteEnvironment: { name: "ssr" },
      persistState: { path: fileURLToPath(new URL("../../.local/d1", import.meta.url)) },
      inspectorPort: false,
    }),
    tanstackStart(),
    react(),
  ],
  server: { host: "127.0.0.1", port: 3002, strictPort: true, allowedHosts: [".ts.net"] },
  preview: { host: "127.0.0.1", port: 3002, strictPort: true, allowedHosts: [".ts.net"] },
  build: { sourcemap: "hidden" },
}));
