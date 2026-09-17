import type { ConfigEnv, UserConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    cloudflare({
      ...(command === "serve" && isPreview !== true
        ? { config: { assets: { binding: "ASSETS", run_worker_first: false } } }
        : {}),
      inspectorPort: false,
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
