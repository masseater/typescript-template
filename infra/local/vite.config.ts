import { lifecycle, testableLibraryRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...testableLibraryRun.tasks,
      config: { cache: false, command: "./src/compose.ts config" },
      logs: { cache: false, command: "./src/compose.ts logs" },
      status: { cache: false, command: "./src/compose.ts status" },
      up: { cache: false, command: "./src/compose.ts up" },
      ...lifecycle({
        precommit: ["check:code"],
        premerge: ["test"],
        prepush: ["check:effect", "check:imports"],
        prepr: [],
        prerelease: [],
      }),
    },
  },
  test: {
    mockReset: true,
    restoreMocks: true,
  },
});
