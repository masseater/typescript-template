import { wikiConfig } from "@repo/vite-config";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(wikiConfig([fumadocsMdx()]));
