import {
  effectDiagnostics,
  lifecycle,
  checkCode,
  modularBoundaries,
  workspaceCheckImports,
  paths,
  taskInput,
} from "@repo/vite-config";

import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const monitorWorkerVite = (
  packageRoot: string,
): {
  readonly pack: PackUserConfig;
  readonly run: NonNullable<UserConfig["run"]>;
  readonly test: NonNullable<UserConfig["test"]>;
} => ({
  pack: {
    deps: {
      alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/],
      onlyBundle: ["effect", "@repo/monitor"],
    },
    dts: false,
    entry: { index: `src/features/${paths.basename(packageRoot)}/worker.ts` },
    format: "esm",
    outExtensions: (): { readonly js: ".js" } => ({ js: ".js" }),
    platform: "browser",
    target: "es2023",
  },
  run: {
    tasks: {
      ...effectDiagnostics(packageRoot),
      ...checkCode,
      ...workspaceCheckImports,
      ...modularBoundaries,
      build: { command: "vp pack", dependsOn: ["check:effect"], input: [...taskInput] },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["build"],
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

export { monitorWorkerVite };
