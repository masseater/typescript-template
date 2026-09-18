import { providers, state } from "alchemy/Cloudflare";

import type { Application } from "@repo/config";

const application = ["database"] as const;
const stackDependencies = {
  admin: application,
  "budget-monitor": ["tokens"],
  database: [],
  email: [],
  "error-monitor": ["tokens"],
  "health-monitor": [],
  observability: [],
  tokens: [],
  user: application,
  wiki: application,
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<Record<Application, typeof application>>;

type StackName = keyof typeof stackDependencies;

const stackNames = [
  "email",
  "database",
  "observability",
  "tokens",
  "budget-monitor",
  "error-monitor",
  "health-monitor",
  "user",
  "admin",
  "wiki",
] as const satisfies readonly StackName[];

const onboardingStack = "email" as const satisfies StackName;
const sendingStacks = [
  "budget-monitor",
  "error-monitor",
  "health-monitor",
  "user",
  "admin",
  "wiki",
] as const satisfies readonly StackName[];

function applyOrderViolations(order: readonly StackName[]): readonly StackName[] {
  const position = new Map(order.map((stack, index) => [stack, index] as const));
  function runsAfter(stack: StackName, required: StackName): boolean {
    const at = position.get(stack);
    const dependency = position.get(required);
    return at !== undefined && dependency !== undefined && dependency < at;
  }
  return order.filter(
    (stack) =>
      !stackDependencies[stack].every((dependency) => runsAfter(stack, dependency)) ||
      (sendingStacks.some((sender) => sender === stack) && !runsAfter(stack, onboardingStack)),
  );
}

function stackName(stack: StackName): string {
  return `template-${stack}`;
}

const stackOptions = { providers: providers(), state: state() };

export {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
  stackOptions,
};
export type { StackName };
