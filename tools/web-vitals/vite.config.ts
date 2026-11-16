import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      measure: {
        command: "web-vitals-flow",
        cache: false,
      },
      "deploy:production": {
        command: `[ -z "$TARGET_URL" ] || web-vitals-flow "$TARGET_URL"`,
        cache: false,
        dependsOn: ["web#deploy:production"],
      },
    },
  },
});
