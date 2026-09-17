import { Effect, Schema } from "effect";
import { providers, state } from "alchemy/Cloudflare";
import type { Application } from "@template/config";

const application = ["database"] as const;
const stackDependencies = {
  admin: application,
  "budget-monitor": ["tokens"],
  database: [],
  "error-monitor": ["tokens"],
  "health-monitor": [],
  tokens: [],
  user: application,
  wiki: application,
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<Record<Application, typeof application>>;
const stackOrder = [
  "database",
  "tokens",
  "budget-monitor",
  "error-monitor",
  "health-monitor",
  "user",
  "admin",
  "wiki",
] as const satisfies readonly (keyof typeof stackDependencies)[];

type StackName = keyof typeof stackDependencies;

interface PlannedStack {
  readonly dependencies: readonly StackName[];
  readonly stack: StackName;
}

class StackFailure extends Schema.TaggedError<StackFailure>()("StackFailure", {
  code: Schema.Literal("stack_dependency_cycle"),
}) {}

function stackName(stack: StackName): string {
  return `template-${stack}`;
}

function visitStack(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ordered: StackName[],
  stack: StackName,
  visiting: readonly StackName[],
): Effect.Effect<void, StackFailure> {
  // oxlint-disable-next-line typescript/no-use-before-define
  return Effect.suspend(() => visitUnordered(ordered, stack, visiting));
}

function visitUnordered(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  ordered: StackName[],
  stack: StackName,
  visiting: readonly StackName[],
): Effect.Effect<void, StackFailure> {
  if (ordered.includes(stack)) {
    return Effect.void;
  }
  if (visiting.includes(stack)) {
    return Effect.fail(new StackFailure({ code: "stack_dependency_cycle" }));
  }
  return Effect.all(
    stackDependencies[stack].map((dependency) =>
      visitStack(ordered, dependency, [...visiting, stack]),
    ),
  ).pipe(
    Effect.tap(() =>
      Effect.sync(() => {
        ordered.push(stack);
      }),
    ),
    Effect.asVoid,
  );
}

const applyPlan = Effect.fn("applyPlan")(function* applyPlan() {
  const ordered: StackName[] = [];
  yield* Effect.all(stackOrder.map((stack) => visitStack(ordered, stack, [])));
  return ordered.map((stack): PlannedStack => ({ dependencies: stackDependencies[stack], stack }));
});

const stackNames = stackOrder;
const stage = "production";
const stackOptions = { providers: providers(), state: state() };

export { applyPlan, stackName, stackNames, stackOptions, stage };
export type { StackName };
