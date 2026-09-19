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
import { defineConfig } from "vite-plus";

import type { ConfigEnv, UserConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(({ command, isPreview }: Readonly<ConfigEnv>): UserConfig => ({
  build: { sourcemap: "hidden" },
  plugins: [
    failOnBrokenSourceMaps(),
    previewDevVars(import.meta.dirname),
    privateSourceMaps("service-admin"),
    devBoundary("service-admin"),
    cloudflare(
      appCloudflare("service-admin", {
        command,
        database: localDatabase,
        isPreview,
        persistState: localDatabasePersistence,
      }),
    ),
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart(startOptions)),
    reactCompiler(),
  ],
  preview: appServer("service-admin"),
  run: appRun,
  server: appServer("service-admin"),
}));
