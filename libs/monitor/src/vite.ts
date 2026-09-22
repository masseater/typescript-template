import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";

function monitorWorkerVite() {
  return {
    pack: {
      deps: {
        alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
        onlyBundle: ["effect", "@repo/monitor"],
      },
      entry: { index: "src/worker.ts" },
      format: "esm" as const,
      outExtensions: () => ({ js: ".js" as const }),
      platform: "browser" as const,
      target: "es2023" as const,
    },
    run: {
      tasks: {
        ...effectDiagnostics,
        build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
        ...lifecycle({
          prepush: ["check:effect"],
          prepr: ["build"],
        }),
      },
    },
  };
}

export { monitorWorkerVite };
