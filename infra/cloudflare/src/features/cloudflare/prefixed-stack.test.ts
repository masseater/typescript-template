import { assert, describe, it } from "@effect/vitest";
import { Stage, inMemoryState } from "alchemy";
import { toEffect } from "alchemy/Test/Core";
import { Cause, Effect, Exit, Predicate } from "effect";

import { applyVerificationEnvironment } from "./inventory.ts";
import { prefixedStack } from "./prefixed-stack.ts";
import { stackName, stackProviders } from "./stacks.ts";
import { verificationSettings } from "./verification-settings.ts";

const { prefix } = verificationSettings;

function compiledAt(stage: string): Effect.Effect<Exit.Exit<unknown, unknown>> {
  applyVerificationEnvironment();
  const deployment = prefixedStack("zone", Effect.succeed({})).pipe(
    Effect.provideService(Stage, stage),
  );
  return Effect.exit(toEffect(deployment, { providers: stackProviders, state: inMemoryState() }));
}

function compiledName(exit: Exit.Exit<unknown, unknown>): unknown {
  return Exit.isSuccess(exit) && Predicate.isObject(exit.value)
    ? Reflect.get(exit.value, "name")
    : undefined;
}

describe("a stack built through the deployment prefix", () => {
  it.effect("compiles when it runs under the stage named after the deployment prefix", () =>
    Effect.gen(function* compiledUnderPrefix() {
      const exit = yield* compiledAt(prefix);
      assert.strictEqual(compiledName(exit), stackName("zone"));
    }),
  );

  it.effect(
    "refuses to run under any other stage, so its state cannot land beside another deployment's",
    () =>
      Effect.gen(function* refusedUnderForeignStage() {
        const exit = yield* compiledAt("live_someone");
        assert.include(
          Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "",
          `stage "live_someone" is not the deployment prefix "${prefix}"; run alchemy with --stage ${prefix}`,
        );
      }),
  );
});
