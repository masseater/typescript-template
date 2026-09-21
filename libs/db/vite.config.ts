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
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check"],
        prepr: [],
        premerge: ["test"],
        prerelease: [],
      }),
    },
  },
  test: {
    coverage: { exclude: ["specs/**"], thresholds: { 100: true, perFile: true } },
    mockReset: true,
    restoreMocks: true,
  },
});
