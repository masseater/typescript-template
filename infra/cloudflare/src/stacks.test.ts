import { Effect, Predicate } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackNames,
  stackReferences,
  traceDestinationStack,
} from "./stacks.ts";

import type { StackName } from "./stacks.ts";

const stackModules: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob([
  "./budget-monitor.ts",
  "./database.ts",
  "./email.ts",
  "./error-monitor.ts",
  "./flagship.ts",
  "./health-monitor.ts",
  "./internal-dashboard.ts",
  "./observability.ts",
  "./service-admin.ts",
  "./service-member.ts",
  "./storage.ts",
  "./tokens.ts",
  "./zone.ts",
]);

function defaultExport(module: unknown): unknown {
  return Predicate.isObject(module) ? Reflect.get(module, "default") : undefined;
}

function violationsWhenLast(last: StackName): readonly StackName[] {
  return applyOrderViolations([...stackNames.filter((stack) => stack !== last), last]).toSorted();
}

describe("alchemy stacks", () => {
  it("every apply unit runs once, after the units it reads from and after the onboarding", () => {
    expect.hasAssertions();
    expect(new Set(stackNames).size).toBe(stackNames.length);
    expect([...stackNames].toSorted()).toStrictEqual(Object.keys(stackReferences).toSorted());
    expect(applyOrderViolations(stackNames)).toStrictEqual([]);
    expect(stackDependencies("service-member")).toContain(traceDestinationStack);
  });

  it("reports the units an apply order would run before what they need", () => {
    expect.hasAssertions();
    expect(violationsWhenLast(onboardingStack)).toStrictEqual([...sendingStacks].toSorted());
    expect(violationsWhenLast("database")).toStrictEqual([
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("flagship")).toStrictEqual([
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("storage")).toStrictEqual(["service-member"]);

    expect(violationsWhenLast(traceDestinationStack)).toStrictEqual([
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
  });

  it.for(stackNames)("%s exports the program the CLI runs", async (stack) => {
    expect.hasAssertions();
    const module: unknown = await stackModules[`./${stack}.ts`]?.();
    expect(Effect.isEffect(defaultExport(module))).toBe(true);
  });
});
