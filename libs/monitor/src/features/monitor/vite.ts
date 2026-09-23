import { effectDiagnostics, lifecycle, modularBoundaries, taskInput } from "@repo/vite-config";

function monitorWorkerVite(feature: string) {
  return {
    pack: {
      deps: {
        alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
        onlyBundle: ["effect", "@repo/monitor"],
      },
      entry: { index: `src/features/${feature}/worker.ts` },
      format: "esm" as const,
      outExtensions: () => ({ js: ".js" as const }),
      platform: "browser" as const,
      target: "es2023" as const,
    },
    run: {
      tasks: {
        ...effectDiagnostics,
        ...modularBoundaries,
        build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
        ...lifecycle({
          prepush: ["check:effect", "check:modular"],
          prepr: ["build"],
        }),
      },
    },
  };
}

export { monitorWorkerVite };
