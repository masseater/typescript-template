import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
} from "./stacks.ts";
import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

const stackModules: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob([
  "./admin.ts",
  "./budget-monitor.ts",
  "./database.ts",
  "./email.ts",
  "./error-monitor.ts",
  "./health-monitor.ts",
  "./tokens.ts",
  "./user.ts",
  "./wiki.ts",
]);

function defaultExport(module: unknown): unknown {
  return typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
}

describe("alchemy stacks", () => {
  it("every apply unit runs once, after the units it reads from and after the onboarding", () => {
    expect.hasAssertions();
    expect(new Set(stackNames).size).toBe(stackNames.length);
    expect([...stackNames].toSorted()).toStrictEqual(Object.keys(stackDependencies).toSorted());
    expect(applyOrderViolations(stackNames)).toStrictEqual([]);
  });

  it("reports the units an apply order would run before what they need", () => {
    expect.hasAssertions();
    const lastOnboarding = [
      ...stackNames.filter((stack) => stack !== onboardingStack),
      onboardingStack,
    ];
    expect(applyOrderViolations(lastOnboarding).toSorted()).toStrictEqual(
      [...sendingStacks].toSorted(),
    );
    const lastDatabase = [
      ...stackNames.filter((stack) => stack !== "database"),
      "database" as const,
    ];
    expect(applyOrderViolations(lastDatabase).toSorted()).toStrictEqual(["admin", "user", "wiki"]);
  });

  it("the apply units and the stack programs on disk are the same set", () => {
    expect.hasAssertions();
    expect(Object.keys(stackModules).toSorted()).toStrictEqual(
      stackNames.map((stack) => `./${stack}.ts`).toSorted(),
    );
  });

  it.for(stackNames)("%s exports the program the CLI runs", async (stack) => {
    expect.hasAssertions();
    const module: unknown = await stackModules[`./${stack}.ts`]?.();
    expect(Effect.isEffect(defaultExport(module))).toBe(true);
  });

  it("stack names are derived from the apply unit", () => {
    expect.hasAssertions();
    expect(stackName("database")).toBe("template-database");
    expect(stackNames.map((stack) => stackName(stack))).toStrictEqual(
      stackNames.map((stack) => `template-${stack}`),
    );
  });
});
