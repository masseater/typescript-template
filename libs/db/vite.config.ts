import { effectDiagnostics, lifecycle } from "@repo/vite-config";
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
      ...lifecycle({ precommit: [], premerge: [], prepush: ["check:effect", "check"] }),
    },
  },
});
