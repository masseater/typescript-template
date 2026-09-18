import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      check: {
        command: "drizzle-kit check",
        input: [{ auto: true }, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
    },
  },
});
