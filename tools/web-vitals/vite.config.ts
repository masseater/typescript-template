import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      measure: {
        command: "web-vitals-flow",
        cache: false,
      },
    },
  },
});
