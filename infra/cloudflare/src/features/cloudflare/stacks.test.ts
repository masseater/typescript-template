import { Stage, inMemoryState } from "alchemy";
import { toEffect } from "alchemy/Test/Core";
import { Cause, Effect, Exit, Predicate } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { withVerificationEnvironment } from "./inventory.ts";
import { path } from "./platform.ts";
import { stackEntrypoint } from "./stack-entrypoints.ts";
import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
  stackProviders,
  stackReferences,
  traceDestinationStack,
} from "./stacks.ts";

import type { StackName } from "./stacks.ts";

const foreignStage = "not-the-deployment-prefix";

const isStackProgram = (value: unknown): value is Parameters<typeof toEffect>[0] =>
  Effect.isEffect(value);

function defaultExport(module: unknown): unknown {
  return Predicate.isObject(module) ? Reflect.get(module, "default") : undefined;
}

function refusal(definition: unknown): Effect.Effect<string> {
  return isStackProgram(definition)
    ? Effect.exit(
        withVerificationEnvironment(
          toEffect(Effect.provideService(definition, Stage, foreignStage), {
            providers: stackProviders,
            state: inMemoryState(),
          }),
        ),
      ).pipe(Effect.map((exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "")))
    : Effect.succeed("");
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
    expect(violationsWhenLast("storage")).toStrictEqual(["internal-dashboard", "service-member"]);
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

    expect(violationsWhenLast(traceDestinationStack)).toStrictEqual([
      "core",
      "internal-dashboard",
      "internal-wiki",
      "service-admin",
      "service-member",
    ]);
    expect(violationsWhenLast("internal-wiki")).toStrictEqual(["internal-dashboard"]);
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
        const location = yield* path.toFileUrl(stackEntrypoint(stack));
        const module: unknown = yield* Effect.promise(() => import(location.href));
        const definition = defaultExport(module);
        expect(Effect.isEffect(definition)).toBe(true);
        expect(
          Predicate.hasProperty(definition, "stackName") ? definition.stackName : undefined,
        ).toBe(stackName(stack));
      }),
    ),
  );

  it.for(stackNames)("%s refuses a stage other than the deployment prefix", (stack) =>
    Effect.runPromise(
      Effect.gen(function* program() {
        expect.hasAssertions();
        const location = yield* path.toFileUrl(stackEntrypoint(stack));
        const module: unknown = yield* Effect.promise(() => import(location.href));
        expect(yield* refusal(defaultExport(module))).toContain(
          `stage "${foreignStage}" is not the deployment prefix`,
        );
      }),
    ),
  );
});
