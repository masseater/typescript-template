import { Context, Effect, Exit, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { workerRuntime } from "./worker-runtime.ts";

class Attempt extends Context.Service<Attempt, { readonly value: string }>()("Attempt") {}

const readAttempt = Effect.gen(function* read() {
  const attempt = yield* Attempt;
  return attempt.value;
});

function buildsInTurn(
  ...outcomes: readonly Effect.Effect<{ readonly value: string }, string>[]
): () => Layer.Layer<Attempt, string> {
  const remaining = outcomes.values();
  return () => Layer.effect(Attempt, remaining.next().value ?? Effect.die("built too often"));
}

describe("a worker runtime whose layer failed to build", () => {
  it("builds the layer again for the next request", () => {
    expect.hasAssertions();
    const runtime = workerRuntime(
      buildsInTurn(Effect.fail("unavailable"), Effect.succeed({ value: "rebuilt" })),
    );
    return Effect.runPromise(
      Effect.gen(function* rebuild() {
        const first = yield* Effect.promise(() => runtime.runPromiseExit(readAttempt));
        const second = yield* Effect.promise(() => runtime.runPromiseExit(readAttempt));
        yield* Effect.promise(() => runtime.dispose());
        expect([Exit.isFailure(first), second]).toStrictEqual([true, Exit.succeed("rebuilt")]);
      }),
    );
  });
});
