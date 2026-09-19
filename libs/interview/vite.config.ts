import { effectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({ run: effectRun });
