import { effectDiagnostics, lifecycle, taskInput } from "@repo/config/vite";

function monitorWorkerVite() {
  return {
    pack: {
      deps: {
        alwaysBundle: ["effect", "@repo/monitor"],
        onlyBundle: ["effect", "@repo/monitor"],
      },
      entry: { index: "src/worker.ts" },
      format: "esm",
      outExtensions: () => ({ js: ".js" }),
      platform: "browser",
      target: "es2023",
    },
    run: {
      tasks: {
        ...effectDiagnostics,
        build: { command: "vp pack", input: [...taskInput] },
        ...lifecycle({
          precommit: [],
          prepush: ["check:effect"],
          prepr: [],
          premerge: ["build"],
          prerelease: [],
        }),
      },
    },
  };
}

export { monitorWorkerVite };
