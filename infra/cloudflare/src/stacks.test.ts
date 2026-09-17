import { applyPlan, projectName, stackReferenceName } from "./stacks.ts";
import { describe, expect, it } from "vite-plus/test";

const projects: Readonly<Record<string, string>> = import.meta.glob<string>("../*/Pulumi.yaml", {
  eager: true,
  import: "default",
});
const plan = applyPlan();
const order = plan.map(({ stack }) => stack);

describe("pulumi stacks", () => {
  it("every stack is applied once, after the stacks whose outputs it consumes", () => {
    expect.hasAssertions();
    expect(new Set(order).size).toBe(order.length);
    const violations = plan.flatMap(({ dependencies, stack }) =>
      dependencies.filter((dependency) => order.indexOf(dependency) >= order.indexOf(stack)),
    );
    expect(violations).toStrictEqual([]);
  });

  it.for(plan)("$stack project name and program are derived from the stack name", ({ stack }) => {
    expect.hasAssertions();
    expect(projects[`../${stack}/Pulumi.yaml`]).toBe(
      `name: ${projectName(stack)}\nruntime:\n  name: nodejs\n  options:\n    typescript: false\nmain: ../src/${stack}.ts\n`,
    );
  });

  it("stack references are fully qualified for the DIY backend in the same environment", () => {
    expect.hasAssertions();
    expect(stackReferenceName("database", "production")).toBe(
      "organization/template-database/production",
    );
  });
});
