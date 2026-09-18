import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";

import { effectDiagnostics, reactCompiler, taskInput } from "@repo/config/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [tailwindcss(), reactCompiler()],
  run: {
    tasks: {
      ...effectDiagnostics,
      build: { command: "vp build", input: [...taskInput, "!dist"] },
      start: { cache: false, command: "node src/cli.ts", dependsOn: ["build"] },
    },
  },
});
