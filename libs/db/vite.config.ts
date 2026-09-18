import { effectDiagnostics } from "@repo/config/vite";
import { defineConfig } from "vite-plus";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  run: {
    tasks: {
      ...effectDiagnostics,
      check: {
        command: "drizzle-kit check",
        input: [{ auto: true }, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
    },
  },
});
