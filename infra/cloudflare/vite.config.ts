import { defineConfig } from "vite-plus";

import { effectRun } from "@repo/config/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({ run: effectRun });
