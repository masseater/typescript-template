import { lifecycle, testableLibraryRun } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...testableLibraryRun.tasks,
      check: {
        command: "drizzle-kit check",
        input: [{ auto: true }, "!node_modules/.cache/**"],
        output: [{ auto: true }, "!node_modules/.cache/**"],
      },
      "db:generate": { cache: false, command: "drizzle-kit generate" },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check"],
        premerge: ["test"],
      }),
    },
  },
  test: {
    mockReset: true,
    restoreMocks: true,
    testTimeout: 30_000,
  },
});
