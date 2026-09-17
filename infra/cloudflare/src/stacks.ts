import { Effect, Schema } from "effect";
import type { Application } from "@template/config";

const application = ["settings", "database"] as const;
const stackDependencies = {
  admin: application,
  "budget-monitor": ["settings", "tokens"],
  database: ["settings"],
  "error-monitor": ["settings", "tokens"],
  "health-monitor": ["settings"],
  settings: [],
  tokens: ["settings"],
  user: application,
  wiki: application,
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<Record<Application, typeof application>>;
const stackOrder = [
  "settings",
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
type DependencyOf<Consumer extends StackName> = (typeof stackDependencies)[Consumer][number];

interface StackOutputs {
  readonly database: "databaseId";
  readonly settings: "applicationSettings" | "authSecret";
  readonly tokens: "billingReadToken" | "observabilityQueryToken";
}

interface PlannedStack {
  readonly dependencies: readonly StackName[];
  readonly stack: StackName;
}

class StackFailure extends Schema.TaggedError<StackFailure>()("StackFailure", {
  code: Schema.Literal("stack_dependency_cycle"),
}) {}

function projectName(stack: StackName): string {
  return `template-${stack}`;
}

function stackReferenceName(source: StackName, environment: string): string {
  return `organization/${projectName(source)}/${environment}`;
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

export { applyPlan, projectName, stackNames, stackReferenceName };
export type { DependencyOf, StackName, StackOutputs };
