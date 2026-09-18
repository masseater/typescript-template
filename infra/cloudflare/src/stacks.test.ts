import { Effect } from "effect";
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
  "./admin.ts",
  "./budget-monitor.ts",
  "./database.ts",
  "./email.ts",
  "./error-monitor.ts",
  "./health-monitor.ts",
  "./observability.ts",
  "./tokens.ts",
  "./user.ts",
  "./wiki.ts",
]);

function defaultExport(module: unknown): unknown {
  return typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
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
    expect(stackDependencies("user")).toContain(traceDestinationStack);
  });

  it("reports the units an apply order would run before what they need", () => {
    expect.hasAssertions();
    expect(violationsWhenLast(onboardingStack)).toStrictEqual([...sendingStacks].toSorted());
    expect(violationsWhenLast("database")).toStrictEqual(["admin", "user", "wiki"]);
    expect(violationsWhenLast(traceDestinationStack)).toStrictEqual(["admin", "user", "wiki"]);
  });

  it.for(stackNames)("%s exports the program the CLI runs", async (stack) => {
    expect.hasAssertions();
    const module: unknown = await stackModules[`./${stack}.ts`]?.();
    expect(Effect.isEffect(defaultExport(module))).toBe(true);
  });
});
