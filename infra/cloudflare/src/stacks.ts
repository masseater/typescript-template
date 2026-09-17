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

function projectName(stack: StackName): string {
  return `template-${stack}`;
}

function stackReferenceName(source: StackName, environment: string): string {
  return `organization/${projectName(source)}/${environment}`;
}

function applyPlan(): PlannedStack[] {
  const ordered: StackName[] = [];
  function visit(stack: StackName, visiting: readonly StackName[]): void {
    if (ordered.includes(stack)) {
      return;
    }
    if (visiting.includes(stack)) {
      throw new Error("stack_dependency_cycle");
    }
    for (const dependency of stackDependencies[stack]) {
      visit(dependency, [...visiting, stack]);
    }
    ordered.push(stack);
  }
  for (const stack of stackOrder) {
    visit(stack, []);
  }
  return ordered.map((stack) => ({ dependencies: stackDependencies[stack], stack }));
}

export { applyPlan, projectName, stackReferenceName };
export type { DependencyOf, StackName, StackOutputs };
