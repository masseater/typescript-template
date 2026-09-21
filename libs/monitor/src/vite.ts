import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";

import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const monitorWorkerVite = (): {
  readonly pack: PackUserConfig;
  readonly run: NonNullable<UserConfig["run"]>;
} => ({
  pack: {
    deps: {
      alwaysBundle: ["effect", "@repo/monitor"],
      onlyBundle: ["effect", "@repo/monitor"],
    },
    entry: { index: "src/worker.ts" },
    format: "esm",
    outExtensions: (): { readonly js: ".js" } => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
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
});

export { monitorWorkerVite };
