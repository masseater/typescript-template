import type { ConfigEnv, UserConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { userDevBoundary } from "./dev-boundary.ts";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
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
  preview: { allowedHosts: [".local"], host: "127.0.0.1", port: 3001, strictPort: true },
  server: { allowedHosts: [".local"], host: "127.0.0.1", port: 3001, strictPort: true },
}));
