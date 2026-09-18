import { APPLICATION } from "@repo/config";
import { appConfig } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig(appConfig(APPLICATION.admin));
