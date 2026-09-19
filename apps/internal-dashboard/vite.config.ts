import { cloudflare } from "@cloudflare/vite-plugin";
import { localDatabase, localDatabasePersistence } from "@repo/db/local";
import { devBoundary } from "@repo/dev-boundary";
import {
  appCloudflare,
  appRun,
  appServer,
  failOnBrokenSourceMaps,
  previewDevVars,
  privateSourceMaps,
  reactCompiler,
  startOptions,
  withoutEnvFileLoader,
} from "@repo/vite-config";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

import type { ConfigEnv, UserConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    failOnBrokenSourceMaps(),
    previewDevVars(import.meta.dirname),
    privateSourceMaps("internal-dashboard"),
    devBoundary("internal-dashboard"),
    cloudflare(
      appCloudflare("internal-dashboard", {
        command,
        database: localDatabase,
        isPreview,
        persistState: localDatabasePersistence,
      }),
    ),
    fumadocsMdx(),
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart(startOptions)),
    reactCompiler(),
  ],
  preview: appServer("internal-dashboard"),
  run: appRun,
  server: appServer("internal-dashboard"),
}));
