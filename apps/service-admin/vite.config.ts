import { cloudflare } from "@cloudflare/vite-plugin";
import {
  appRun,
  appServer,
  failOnBrokenSourceMaps,
  previewDevVars,
  privateSourceMaps,
  reactCompiler,
  startOptions,
  withoutEnvFileLoader,
} from "@repo/config/vite";
import { workerCompatibility } from "@repo/config/worker";
import { localDatabase, localDatabasePersistence } from "@repo/db/local";
import { devBoundary } from "@repo/dev-boundary";
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
    cloudflare({
      config: {
        assets: { binding: "ASSETS", run_worker_first: command !== "serve" || isPreview === true },
        compatibility_date: workerCompatibility.date,
        compatibility_flags: [...workerCompatibility.flags],
        d1_databases: [localDatabase],
        main: "./src/app/server.ts",
        name: "template-admin",
      },
      inspectorPort: false,
      persistState: { path: localDatabasePersistence },
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    ...withoutEnvFileLoader(tanstackStart(startOptions)),
    reactCompiler(),
  ],
  preview: appServer("service-admin"),
  run: appRun,
  server: appServer("service-admin"),
}));
