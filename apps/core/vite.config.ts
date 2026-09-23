import { effectDiagnostics, lifecycle, modularBoundaries, taskInput } from "@repo/vite-config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: {
      alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
      onlyBundle: ["@better-auth/core", "better-call", "drizzle-orm", "effect", "msgpackr"],
    },
    entry: { index: "src/features/core/worker.ts" },
    format: "esm" as const,
    outExtensions: () => ({ js: ".js" }),
    platform: "browser" as const,
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics,
      ...modularBoundaries,
      build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
      ...lifecycle({
        precommit: [],
        prepush: ["check:effect", "check:modular"],
        prepr: ["build"],
        premerge: [],
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
