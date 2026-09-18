import { defineConfig } from "vite-plus";

import { effectRun } from "./src/vite.ts";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({ run: effectRun });
