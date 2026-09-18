import { applications } from "@repo/config";
import { providers, state } from "alchemy/Cloudflare";

import { monitorStacks } from "./monitors.ts";

import type { Application } from "@repo/config";
import type { MonitorStack } from "./monitors.ts";

const application = ["database"] as const;
const stackReferences = {
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
  zone: [],
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<Record<Application, typeof application>> &
  Readonly<Record<MonitorStack, readonly string[]>>;

type StackName = keyof typeof stackReferences;

const traceDestinationStack = "observability" as const satisfies StackName;

const dependenciesByName: Readonly<Partial<Record<StackName, readonly StackName[]>>> = {
  admin: [traceDestinationStack],
  user: [traceDestinationStack],
  wiki: [traceDestinationStack],
} satisfies Readonly<Record<Application, readonly StackName[]>>;

function stackDependencies(stack: StackName): readonly StackName[] {
  return [...stackReferences[stack], ...(dependenciesByName[stack] ?? [])];
}

const stackNames = [
  "zone",
  "email",
  "database",
  "observability",
  "tokens",
  ...monitorStacks,
  "user",
  "admin",
  "wiki",
] as const satisfies readonly StackName[];

const applicationStacks: readonly StackName[] = applications;

const onboardingStack = "email" as const satisfies StackName;
const sendingStacks = [
  ...monitorStacks,
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
      !stackDependencies(stack).every((dependency) => runsAfter(stack, dependency)) ||
      (sendingStacks.some((sender) => sender === stack) && !runsAfter(stack, onboardingStack)),
  );
}

function stackName(stack: StackName): string {
  return `template-${stack}`;
}

const stackOptions = { providers: providers(), state: state() };

export {
  applicationStacks,
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
  stackOptions,
  stackReferences,
  traceDestinationStack,
};
export type { StackName };
