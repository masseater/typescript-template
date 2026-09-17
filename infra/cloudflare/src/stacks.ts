import type { Application } from "@template/config";

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

function isStackName(value: unknown): value is StackName {
  return typeof value === "string" && Object.hasOwn(stackDependencies, value);
}

const stackNames = Object.keys(stackDependencies).filter(isStackName);

export function projectName(stack: StackName): string {
  return `template-${stack}`;
}

export function stackReferenceName(source: StackName, environment: string): string {
  return `organization/${projectName(source)}/${environment}`;
}

export function applyPlan(): { stack: StackName; dependencies: readonly StackName[] }[] {
  const ordered: StackName[] = [];
  const visiting = new Set<StackName>();
  const visit = (stack: StackName) => {
    if (ordered.includes(stack)) return;
    if (visiting.has(stack)) throw new Error("stack_dependency_cycle");
    visiting.add(stack);
    for (const dependency of stackDependencies[stack]) visit(dependency);
    visiting.delete(stack);
    ordered.push(stack);
  };
  for (const stack of stackNames) visit(stack);
  return ordered.map((stack) => ({ stack, dependencies: stackDependencies[stack] }));
}
