import { pathToFileURL } from "node:url";

import { Effect, Predicate } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { stackEntrypoint } from "./stack-entrypoints.ts";
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
      "core",
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("flagship")).toStrictEqual([
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("core")).toStrictEqual([
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("storage")).toStrictEqual(["service-member"]);

    expect(violationsWhenLast(traceDestinationStack)).toStrictEqual([
      "core",
      "internal-dashboard",
      "service-admin",
      "service-member",
    ]);
  });

  it("points application stacks at apps alchemy entrypoints", () => {
    expect.hasAssertions();
    for (const [stack, relative] of [
      ["core", "apps/core/alchemy.run.ts"],
      ["service-admin", "apps/service-admin/alchemy.run.ts"],
      ["service-member", "apps/service-member/alchemy.run.ts"],
      ["internal-dashboard", "apps/internal-dashboard/alchemy.run.ts"],
    ] as const) {
      expect(stackEntrypoint(stack).endsWith(relative)).toBe(true);
    }
  });

  it.for(stackNames)("%s exports the program the CLI runs", (stack) =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const module: unknown = yield* Effect.promise(
          () => import(pathToFileURL(stackEntrypoint(stack)).href),
        );
        expect(Effect.isEffect(defaultExport(module))).toBe(true);
      }),
    ),
  );
});
