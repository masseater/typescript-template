import { Context, Effect, Exit, Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { workerRuntime } from "./worker-runtime.ts";

class Attempt extends Context.Service<Attempt, { readonly value: string }>()("Attempt") {}

describe("a worker runtime whose layer failed to build", () => {
  const it = test.extend("attemptOutcomes", () => {
    const outcomes = [Effect.fail("unavailable"), Effect.succeed({ value: "rebuilt" })].values();
    const runtime = workerRuntime(() =>
      Layer.effect(Attempt, outcomes.next().value ?? Effect.die("built too often")),
    );
    const readAttempt = Effect.gen(function* readAttemptProgram() {
      const attempt = yield* Attempt;
      return attempt.value;
    });
    return Effect.runPromise(
      Effect.gen(function* rebuildProgram() {
        const first = yield* Effect.promise(() => runtime.runPromiseExit(readAttempt));
        const second = yield* Effect.promise(() => runtime.runPromiseExit(readAttempt));
        yield* Effect.promise(() => runtime.dispose());
        return { firstFailed: Exit.isFailure(first), second };
      }),
    );
  });

  it("builds the layer again for the next request", ({ attemptOutcomes }) => {
    expect(attemptOutcomes).toStrictEqual({ firstFailed: true, second: Exit.succeed("rebuilt") });
  });
});
