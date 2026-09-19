import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:effect": {
        command:
          "effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning",
      },
    },
  },
});
