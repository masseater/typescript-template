import { APPLICATION } from "@repo/config";
import { appConfig } from "@repo/vite-config";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig(APPLICATION.wiki, [fumadocsMdx()]));
