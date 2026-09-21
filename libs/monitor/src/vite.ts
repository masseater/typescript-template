import { effectDiagnostics, lifecycle, taskInput } from "@repo/vite-config";

import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const monitorWorkerTest = {
  coverage: {
    exclude: ["specs/**"],
    thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
  },
  mockReset: true,
  restoreMocks: true,
} as const satisfies NonNullable<UserConfig["test"]>;

const monitorWorkerVite = (): {
  readonly pack: PackUserConfig;
  readonly run: NonNullable<UserConfig["run"]>;
  readonly test: NonNullable<UserConfig["test"]>;
} => ({
  pack: {
    deps: {
      alwaysBundle: ["effect", "@repo/monitor"],
      onlyBundle: ["effect", "@repo/monitor"],
    },
    dts: false,
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
  test: monitorWorkerTest,
});

export { monitorWorkerTest, monitorWorkerVite };
