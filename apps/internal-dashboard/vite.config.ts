import { appConfig } from "@repo/vite-config";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig("internal-dashboard", [fumadocsMdx()]));
