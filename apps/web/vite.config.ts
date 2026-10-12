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
