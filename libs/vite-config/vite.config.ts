import { defineConfig } from "vite-plus";

import { awaitingEffectRun } from "./src/features/vite-config/vite.ts";

export default defineConfig({
  run: awaitingEffectRun(import.meta.dirname),
});
