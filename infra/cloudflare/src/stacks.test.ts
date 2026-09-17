import { applyPlan, stackName, stackNames } from "./stacks.ts";
import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

const stackModules: Readonly<Record<string, () => Promise<unknown>>> = import.meta.glob([
  "./admin.ts",
  "./budget-monitor.ts",
  "./database.ts",
  "./error-monitor.ts",
  "./health-monitor.ts",
  "./tokens.ts",
  "./user.ts",
  "./wiki.ts",
]);
function defaultExport(module: unknown): unknown {
  return typeof module === "object" && module !== null ? Reflect.get(module, "default") : undefined;
}

const plan = await Effect.runPromise(applyPlan());
const order = plan.map(({ stack }) => stack);

describe("alchemy stacks", () => {
  it("every apply unit runs once, after the units whose outputs it consumes", () => {
    expect.hasAssertions();
    expect(new Set(order).size).toBe(order.length);
    expect(order).toStrictEqual(expect.arrayContaining([...stackNames]));
    const violations = plan.flatMap(({ dependencies, stack }) =>
      dependencies.filter((dependency) => order.indexOf(dependency) >= order.indexOf(stack)),
    );
    expect(violations).toStrictEqual([]);
  });

  it("the apply units and the stack programs on disk are the same set", () => {
    expect.hasAssertions();
    expect(Object.keys(stackModules).toSorted()).toStrictEqual(
      stackNames.map((stack) => `./${stack}.ts`).toSorted(),
    );
  });

  it.for(plan)("$stack exports the program the CLI runs", async ({ stack }) => {
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
