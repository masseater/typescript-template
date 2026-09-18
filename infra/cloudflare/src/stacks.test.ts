import { describe, expect, it } from "vite-plus/test";
import { stackDependencies, stackName, stackNames } from "./stacks.ts";
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
  it("every apply unit runs once, after the units whose resources it reads", () => {
    expect.hasAssertions();
    expect(new Set(stackNames).size).toBe(stackNames.length);
    expect([...stackNames].toSorted()).toStrictEqual(Object.keys(stackDependencies).toSorted());
    const violations = stackNames.flatMap((stack) =>
      stackDependencies[stack].filter(
        (dependency) => stackNames.indexOf(dependency) >= stackNames.indexOf(stack),
      ),
    );
    expect(violations).toStrictEqual([]);
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
