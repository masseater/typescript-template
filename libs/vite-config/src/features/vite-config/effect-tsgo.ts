import { effectTsgoNoEmit } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect } from "effect";

import { baselinePath } from "./effect-typecheck.ts";
import { paths } from "./host.ts";
import { telemetryEnv } from "./run-config.ts";
import { taskInput } from "./task-input.ts";
import { workspaceDependencyRanges } from "./workspace-packages.ts";

const typecheckedFiles = ["**/*.{ts,tsx}", "**/package.json", "**/tsconfig*.json"] as const;
const generatedTrees = ["node_modules", "dist", ".paraglide", ".local"] as const;

const dependencyRanges = await Effect.runPromise(workspaceDependencyRanges(repositoryRoot));

const workspacePath = (absolutePath: string): string =>
  paths.relative(repositoryRoot, absolutePath).split(paths.sep).join("/") || ".";

const containsDirectory = (outer: string, inner: string): boolean =>
  outer !== inner && (outer === "." || inner.startsWith(`${outer}/`));

type TaskInputEntry = { auto: true } | { base: "package" | "workspace"; pattern: string };

const effectTypecheckInputs = (packageRoot: string): TaskInputEntry[] => {
  const directory = workspacePath(packageRoot);
  const range = dependencyRanges.get(directory) ?? [directory];
  const nestedOutsideRange = [...dependencyRanges.keys()].filter(
    (workspaceDirectory) =>
      !range.includes(workspaceDirectory) &&
      range.some((covered) => containsDirectory(covered, workspaceDirectory)),
  );
  return [
    ...taskInput,
    ...range.flatMap((directory) =>
      typecheckedFiles.map((pattern) => ({
        base: "workspace" as const,
        pattern: directory === "." ? pattern : `${directory}/${pattern}`,
      })),
    ),
    ...nestedOutsideRange.map((workspaceDirectory) => ({
      base: "workspace" as const,
      pattern: `!${workspaceDirectory}/**`,
    })),
    ...generatedTrees.map((tree) => ({ base: "workspace" as const, pattern: `!**/${tree}/**` })),
    ...(directory === "." ? [] : [{ base: "package" as const, pattern: "!." }]),
  ];
};

type EffectDiagnosticsTask = {
  "check:effect": { command: string; input: TaskInputEntry[]; env: string[] };
};

const effectDiagnostics = (packageRoot: string): EffectDiagnosticsTask => ({
  "check:effect": {
    command: effectTsgoNoEmit("tsconfig.json"),
    input: effectTypecheckInputs(packageRoot),
    env: [...telemetryEnv],
  },
});

const awaitingEffectDiagnostics = (packageRoot: string): EffectDiagnosticsTask => ({
  "check:effect": {
    command: "dont-review-it-effect-typecheck",
    input: [
      ...effectTypecheckInputs(packageRoot),
      { base: "workspace" as const, pattern: workspacePath(baselinePath) },
    ],
    env: [...telemetryEnv],
  },
});

export { awaitingEffectDiagnostics, effectDiagnostics, effectTsgoNoEmit };
export type { EffectDiagnosticsTask, TaskInputEntry };
