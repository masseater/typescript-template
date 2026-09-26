import { awaitingEffectRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: awaitingEffectRun(import.meta.dirname),
});
