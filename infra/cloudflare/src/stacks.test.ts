import { Effect } from "effect";
import { expect, test } from "vite-plus/test";
import { applyPlan, projectName, stackReferenceName } from "./stacks.ts";

const projects = import.meta.glob<string>("../*/Pulumi.yaml", { eager: true, import: "default" });
const plan = Effect.runSync(applyPlan());

test("every stack is applied once, after the stacks whose outputs it consumes", () => {
  const order = plan.map(({ stack }) => stack);
  expect(new Set(order).size).toBe(order.length);
  for (const { stack, dependencies } of plan)
    for (const dependency of dependencies)
      expect(order.indexOf(dependency)).toBeLessThan(order.indexOf(stack));
});

test.for(plan)("$stack project name and program are derived from the stack name", ({ stack }) => {
  expect(projects[`../${stack}/Pulumi.yaml`]).toBe(
    `name: ${projectName(stack)}\nruntime:\n  name: nodejs\n  options:\n    typescript: false\nmain: ../src/${stack}.ts\n`,
  );
});

test("stack references are fully qualified for the DIY backend in the same environment", () => {
  expect(stackReferenceName("database", "production")).toBe(
    "organization/template-database/production",
  );
});
