import { wikiConfig } from "@repo/vite-config";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig((env) => ({
  ...wikiConfig([fumadocsMdx()])(env),
  test: {
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
}));
