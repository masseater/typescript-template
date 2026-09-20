import { appConfig } from "@repo/config/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig("internal-dashboard", [fumadocsMdx()]));
