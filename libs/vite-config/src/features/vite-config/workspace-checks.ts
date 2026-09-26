import { measured, type Tasks } from "./run-config.ts";
import { taskInput } from "./task-input.ts";

const checkCode = measured({
  "check:code": { command: "vp check --no-error-on-unmatched-pattern", input: [...taskInput] },
} satisfies Tasks);

const workspaceCheckImports = measured({
  "check:imports": { command: "dont-review-it-imports", input: [...taskInput] },
} satisfies Tasks);

const modularBoundaries = measured({
  "check:modular": { command: "dont-review-it-modular", input: [...taskInput] },
} satisfies Tasks);

export { checkCode, modularBoundaries, workspaceCheckImports };
