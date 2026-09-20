import { APPLICATION } from "@repo/config";
import { appConfig } from "@repo/config/vite";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig(APPLICATION.wiki, [fumadocsMdx()]));
