import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      measure: {
        command: "node src/main.ts",
        cache: false,
      },
    },
  },
});
