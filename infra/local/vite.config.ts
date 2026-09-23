import { lifecycle, testableLibraryRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...testableLibraryRun.tasks,
      config: { cache: false, command: "./src/features/local/compose.ts config" },
      logs: { cache: false, command: "./src/features/local/compose.ts logs" },
      status: { cache: false, command: "./src/features/local/compose.ts status" },
      up: { cache: false, command: "./src/features/local/compose.ts up" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        premerge: ["test"],
      }),
    },
  },
  test: {
    mockReset: true,
    restoreMocks: true,
  },
});
