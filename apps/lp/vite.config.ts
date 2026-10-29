import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

import { externalizeInlineScripts } from "./inline-scripts.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["*.test.ts"] },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src/app",
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
    }),
    viteReact(),
    externalizeInlineScripts(),
  ],
});
