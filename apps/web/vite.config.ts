import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { Option } from "effect";
import { defineConfig } from "vite-plus";

import { SEARCH_INDEX_ORIGIN, SITEMAP_FILE } from "./src/shared/config/index.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  msch: { lint: { overrides: [{ files: ["src/**/*.{ts,tsx}"], use: ["decision", "traced"] }] } },
  run: {
    tasks: {
      dev: { command: "alchemy dev", cache: false },
      deploy: { command: "alchemy deploy", cache: false },
      destroy: { command: "alchemy destroy", cache: false },
      "deploy:production": {
        command: [
          "alchemy deploy --stage production --yes",
          `[ -z "$TARGET_URL" ] || WORKERS_TRACES_SINK=masseater-dev-trace-sink workers-traces --request "$TARGET_URL" --expect GET --expect d1_all --wait 300`,
        ],
        cache: false,
      },
      "db:generate": "drizzle-kit generate",
      "db:check": [
        "drizzle-kit check",
        `drizzle-kit generate --explain --output json | grep -q '"status":"no_changes"'`,
      ],
      "auth:generate": {
        command:
          "auth generate --config src/shared/auth/auth.server.ts --output src/shared/db/generated/auth.table.ts --yes",
      },
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: "app", include: ["src/**/*.test.{ts,tsx}"] } },
      { extends: false, test: { name: "alchemy", include: ["*.test.ts"] } },
    ],
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src/app",
      rsc: { enabled: true },
      pages: [{ path: "/" }],
      sitemap: Option.match(SEARCH_INDEX_ORIGIN, {
        onNone: () => ({ enabled: false }),
        onSome: (host) => ({ host, outputPath: SITEMAP_FILE }),
      }),
    }),
    rsc(),
    viteReact(),
  ],
});
