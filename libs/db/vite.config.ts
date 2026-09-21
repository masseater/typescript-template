import { coveredTestableLibraryRun, lifecycle } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      ...coveredTestableLibraryRun.tasks,
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
    coverage: {
      exclude: ["specs/**"],
      thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
    },
    mockReset: true,
    restoreMocks: true,
  },
});
