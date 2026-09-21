import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";

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
        build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
        ...lifecycle({
          precommit: [],
          prepush: ["check:effect"],
          prepr: ["build"],
          premerge: [],
          prerelease: [],
        }),
      },
    },
  };
}

export { monitorWorkerVite };
