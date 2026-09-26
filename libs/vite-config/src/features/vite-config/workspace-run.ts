import {
  awaitingEffectDiagnostics,
  effectDiagnostics,
  type EffectDiagnosticsTask,
} from "./effect-tsgo.ts";
import { paths } from "./host.ts";
import { lifecycle } from "./lifecycle.ts";
import { measured, telemetryEnv, type Tasks } from "./run-config.ts";
import { taskInput } from "./task-input.ts";
import { testRun } from "./test-run.ts";

import type { UserConfig } from "vite-plus";
import type { PackUserConfig } from "vite-plus/pack";

const intentValidation = measured({
  check: { command: "intent validate", input: [...taskInput] },
} satisfies Tasks);

const checkCode = measured({
  "check:code": { command: "vp check --no-error-on-unmatched-pattern", input: [...taskInput] },
} satisfies Tasks);

const workspaceCheckImports = measured({
  "check:imports": { command: "dont-review-it-imports", input: [...taskInput] },
} satisfies Tasks);

const modularBoundaries = measured({
  "check:modular": { command: "dont-review-it-modular", input: [...taskInput] },
} satisfies Tasks);

const effectRunTasks = measured({
  ...checkCode,
  ...workspaceCheckImports,
  ...modularBoundaries,
  ...lifecycle({
    precommit: ["check:code"],
    prepush: ["check:effect", "check:imports", "check:modular"],
  }),
} satisfies Tasks);

const effectRun = (
  packageRoot: string,
): { tasks: typeof effectRunTasks & EffectDiagnosticsTask } => ({
  tasks: { ...effectDiagnostics(packageRoot), ...effectRunTasks },
});

const awaitingEffectRun = (
  packageRoot: string,
): { tasks: typeof effectRunTasks & EffectDiagnosticsTask } => ({
  tasks: { ...awaitingEffectDiagnostics(packageRoot), ...effectRunTasks },
});

const toolRun = (packageRoot: string): NonNullable<UserConfig["run"]> => ({
  tasks: {
    ...effectDiagnostics(packageRoot),
    ...checkCode,
    ...workspaceCheckImports,
    ...modularBoundaries,
    ...intentValidation,
    ...testRun,
    ...lifecycle({
      precommit: ["check:code"],
      prepush: ["check:effect", "check:imports", "check", "check:modular"],
      prepr: ["test"],
    }),
  },
});

const toolTest = {
  mockReset: true,
  restoreMocks: true,
  coverage: {
    exclude: ["specs/**"],
    thresholds: { branches: 50, functions: 50, lines: 50, statements: 50, perFile: true },
  },
  unstubEnvs: true,
  unstubGlobals: true,
} satisfies NonNullable<UserConfig["test"]>;

const workerPackage = (
  packageRoot: string,
  onlyBundle: readonly string[],
): { readonly pack: PackUserConfig; readonly run: NonNullable<UserConfig["run"]> } => ({
  pack: {
    deps: { alwaysBundle: [/^@repo\//, /^effect(?:\/|$)/], onlyBundle: [...onlyBundle] },
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
      build: {
        command: "vp pack",
        dependsOn: ["check:effect"],
        input: [...taskInput],
        env: [...telemetryEnv],
      },
      ...lifecycle({
        precommit: ["check:code"],
        prepush: ["check:effect", "check:imports", "check:modular"],
        prepr: ["build"],
      }),
    },
  },
});

export {
  awaitingEffectRun,
  checkCode,
  effectRun,
  intentValidation,
  modularBoundaries,
  toolRun,
  toolTest,
  workerPackage,
  workspaceCheckImports,
};
