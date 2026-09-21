import { APPLICATION, applications } from "@repo/config";
import { providers, state } from "alchemy/Cloudflare";

import { monitorStacks } from "./monitors.ts";

import type { Application } from "@repo/config";
import type { MonitorStack } from "./monitors.ts";

const application = ["database", "flagship"] as const;
const wikiApplication = [...application, "tokens"] as const;
const stackReferences = {
  "service-admin": application,
  "budget-monitor": ["tokens"],
  database: [],
  email: [],
  flagship: [],
  "error-monitor": ["tokens"],
  "health-monitor": [],
  observability: [],
  storage: [],
  tokens: [],
  "service-member": [...application, "storage"],
  "internal-dashboard": wikiApplication,
  zone: [],
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<
    Record<Exclude<Application, typeof APPLICATION.wiki>, typeof application> &
      Record<typeof APPLICATION.wiki, typeof wikiApplication>
  > &
  Readonly<Record<MonitorStack, readonly string[]>>;

type StackName = keyof typeof stackReferences;

const traceDestinationStack = "observability" as const satisfies StackName;

const dependenciesByName: Readonly<Partial<Record<StackName, readonly StackName[]>>> = {
  "service-admin": [traceDestinationStack],
  "service-member": [traceDestinationStack],
  "internal-dashboard": [traceDestinationStack],
} satisfies Readonly<Record<Application, readonly StackName[]>>;

function stackDependencies(stack: StackName): readonly StackName[] {
  return [...stackReferences[stack], ...(dependenciesByName[stack] ?? [])];
}

const stackNames = [
  "zone",
  "email",
  "database",
  "storage",
  "flagship",
  "observability",
  "tokens",
  ...monitorStacks,
  APPLICATION.user,
  APPLICATION.admin,
  APPLICATION.wiki,
] as const satisfies readonly StackName[];

const applicationStacks: readonly StackName[] = applications;

const onboardingStack = "email" as const satisfies StackName;
const sendingStacks = [
  ...monitorStacks,
  APPLICATION.user,
  APPLICATION.admin,
  APPLICATION.wiki,
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
