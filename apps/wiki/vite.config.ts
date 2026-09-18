import type { ConfigEnv, UserConfig } from "vite-plus";
import {
  appRun,
  appServer,
  previewDevVars,
  reactCompiler,
  startOptions,
  withoutEnvFileLoader,
} from "@repo/config/vite";
import { localDatabase, localDatabasePersistence } from "@repo/db/local";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite-plus";
import { devBoundary } from "@repo/dev-boundary";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { workerCompatibility } from "@repo/config/worker";

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
        main: "./src/app/server.ts",
        name: "template-wiki",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    fumadocsMdx(),
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart(startOptions)),
    reactCompiler(),
  ],
  preview: appServer("wiki"),
  run: appRun,
  server: appServer("wiki"),
}));
