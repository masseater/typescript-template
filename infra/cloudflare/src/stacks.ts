import type { Application } from "@template/config";
import { Effect, Schema } from "effect";

const application = ["settings", "database"] as const;
const stackDependencies = {
  settings: [],
  database: ["settings"],
  tokens: ["settings"],
  "budget-monitor": ["settings", "tokens"],
  "error-monitor": ["settings", "tokens"],
  "health-monitor": ["settings"],
  user: application,
  admin: application,
  wiki: application,
} as const satisfies Record<string, readonly string[]> & Record<Application, typeof application>;

export type StackName = keyof typeof stackDependencies;
export type DependencyOf<T extends StackName> = (typeof stackDependencies)[T][number];

export interface StackOutputs {
  settings: "applicationSettings" | "authSecret";
  database: "databaseId";
  tokens: "billingReadToken" | "observabilityQueryToken";
}

export class StackFailure extends Schema.TaggedError<StackFailure>()("StackFailure", {
  code: Schema.Literal("stack_dependency_cycle"),
}) {}

function isStackName(value: unknown): value is StackName {
  return typeof value === "string" && Object.hasOwn(stackDependencies, value);
}

export const stackNames = Object.keys(stackDependencies).filter(isStackName);

export function projectName(stack: StackName): string {
  return `template-${stack}`;
}

export function stackReferenceName(source: StackName, environment: string): string {
  return `organization/${projectName(source)}/${environment}`;
}

export const applyPlan = Effect.fn("applyPlan")(function* () {
  const ordered: StackName[] = [];
  const visit = (
    stack: StackName,
    visiting: readonly StackName[],
  ): Effect.Effect<void, StackFailure> =>
    Effect.gen(function* () {
      if (ordered.includes(stack)) return;
      if (visiting.includes(stack))
        return yield* new StackFailure({ code: "stack_dependency_cycle" });
      for (const dependency of stackDependencies[stack])
        yield* visit(dependency, [...visiting, stack]);
      ordered.push(stack);
    });
  for (const stack of stackNames) yield* visit(stack, []);
  return ordered.map((stack) => ({
    stack,
    dependencies: stackDependencies[stack] as readonly StackName[],
  }));
});
