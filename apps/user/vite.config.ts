import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { userDevBoundary } from "./dev-boundary.ts";

export default defineConfig(({ command, isPreview }) => ({
  build: { sourcemap: "hidden" },
  plugins: [
    userDevBoundary(),
    cloudflare({
      ...(command === "serve" && isPreview !== true
        ? { config: { assets: { binding: "ASSETS", run_worker_first: false } } }
        : {}),
      inspectorPort: false,
      persistState: { path: fileURLToPath(new URL("../../.local/d1", import.meta.url)) },
      viteEnvironment: { name: "ssr" },
    }),
    tanstackStart(),
    react(),
  ],
  preview: { allowedHosts: [".ts.net"], host: "127.0.0.1", port: 3001, strictPort: true },
  server: { allowedHosts: [".ts.net"], host: "127.0.0.1", port: 3001, strictPort: true },
}));
