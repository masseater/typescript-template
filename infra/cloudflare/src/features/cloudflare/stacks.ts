import { APPLICATION, applications } from "@repo/config";
import { providers, state } from "alchemy/Cloudflare";
import * as Stripe from "alchemy/Stripe";
import { Layer } from "effect";

import { monitorStacks } from "./monitors.ts";

import type { MonitorStack } from "./monitors.ts";

const application = ["database", "flagship"] as const;
const wikiApplication = [...application, "tokens"] as const;
const servedApplication = [...application, "core"] as const;
const memberServed = [...servedApplication, "storage"] as const;
const wikiServed = [...wikiApplication, "core", "internal-wiki", "storage"] as const;
const stackReferences = {
  "service-admin": servedApplication,
  "budget-monitor": ["tokens"],
  core: ["database"],
  database: [],
  email: [],
  flagship: [],
  "error-monitor": ["tokens"],
  "health-monitor": [],
  observability: [],
  storage: [],
  tokens: [],
  "service-member": memberServed,
  "internal-dashboard": wikiServed,
  "internal-wiki": [],
  zone: [],
} as const satisfies Readonly<Record<string, readonly string[]>> &
  Readonly<
    Record<typeof APPLICATION.admin, typeof servedApplication> &
      Record<typeof APPLICATION.user, typeof memberServed> &
      Record<typeof APPLICATION.dashboard, typeof wikiServed>
  > &
  Readonly<Record<MonitorStack, readonly string[]>>;

type StackName = keyof typeof stackReferences;

const packageStacks = [
  ...applications,
  "core",
  "internal-wiki",
] as const satisfies readonly StackName[];
type PackageStack = (typeof packageStacks)[number];

const traceDestinationStack = "observability" as const satisfies StackName;

const dependenciesByName: Readonly<Partial<Record<StackName, readonly StackName[]>>> = {
  core: [traceDestinationStack],
  "service-admin": [traceDestinationStack],
  "service-member": [traceDestinationStack],
  "internal-dashboard": [traceDestinationStack],
  "internal-wiki": [traceDestinationStack],
} satisfies Readonly<Record<PackageStack, readonly StackName[]>>;

function stackDependencies(stack: StackName): readonly StackName[] {
  return [...stackReferences[stack], ...(dependenciesByName[stack] ?? [])];
}

const stackNames = [
  "zone",
  "email",
  "database",
  "flagship",
  "storage",
  "observability",
  "core",
  "internal-wiki",
  "tokens",
  ...monitorStacks,
  APPLICATION.user,
  APPLICATION.admin,
  APPLICATION.dashboard,
] as const satisfies readonly StackName[];

const onboardingStack = "email" as const satisfies StackName;
const sendingStacks = [
  "core",
  ...monitorStacks,
  APPLICATION.user,
  APPLICATION.admin,
  APPLICATION.dashboard,
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

const stackProviders = providers().pipe(Layer.provideMerge(Stripe.providers()));

const stackOptions = { providers: stackProviders, state: state() };

export {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
  stackOptions,
  stackProviders,
  stackReferences,
  traceDestinationStack,
};
export type { PackageStack, StackName };
