import { APPLICATION } from "@repo/config";
import { appConfig } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

export default defineConfig(appConfig(APPLICATION.admin));
