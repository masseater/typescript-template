import { reactCompiler, taskInput } from "@repo/config/vite";
import { defineConfig } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";

// oxlint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [tailwindcss(), reactCompiler()],
  run: {
    tasks: {
      assets: {
        cache: false,
        command: [
          "rsync -a --delete $HOME/.claude/skills/commander/ assets/commander/",
          "rsync -a --delete $HOME/.claude/skills/coordinator/ assets/coordinator/",
        ],
      },
      build: { command: "vp build", input: [...taskInput, "!dist"] },
      start: { cache: false, command: "node src/cli.ts", dependsOn: ["build"] },
    },
  },
});
