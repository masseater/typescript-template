import { assert, it } from "@effect/vitest";
import { Cause, Context, Duration, Effect, Exit, Fiber, Latch, Layer } from "effect";
import { TestClock } from "effect/testing";

import { disposedRuntime, isolateCache, isolateRuntime } from "./isolate.ts";

const firstAttempt = 1;
const secondAttempt = 2;

class BuildMark extends Context.Service<BuildMark, { readonly ordinal: number }>()(
  "@repo/runtime/test/BuildMark",
) {}

interface GatedLayer {
  readonly attempts: () => number;
  readonly closed: () => number;
  readonly layer: Layer.Layer<BuildMark>;
  readonly open: Effect.Effect<boolean>;
}

function gatedLayer(): GatedLayer {
  const gate = Latch.makeUnsafe(false);
  let started = 0;
  let released = 0;
  const acquired = Effect.suspend(() => {
    started += 1;
    const ordinal = started;
    return gate.await.pipe(Effect.as(BuildMark.of({ ordinal })));
  });
  const releasing = Effect.sync(() => {
    released += 1;
  });
  return {
    attempts: () => started,
    closed: () => released,
    layer: Layer.effect(
      BuildMark,
      Effect.acquireRelease(acquired, () => releasing),
    ),
    open: Latch.open(gate),
  };
}

const ordinal = Effect.map(BuildMark, (mark) => mark.ordinal);

it.effect("every request that arrives before a context settled starts its own build", () =>
  Effect.gen(function* program() {
    const gated = gatedLayer();
    const runtime = isolateRuntime(gated.layer);
    const both = [runtime.runPromiseExit(ordinal), runtime.runPromiseExit(ordinal)];
    yield* gated.open;
    const settled = yield* Effect.promise(async () => Promise.all(both));
    assert.deepStrictEqual(
      settled,
      both.map(() => Exit.succeed(firstAttempt)),
    );
    assert.deepStrictEqual([gated.attempts(), gated.closed()], [secondAttempt, firstAttempt]);
    yield* Effect.promise(async () => runtime.dispose());
    assert.strictEqual(gated.closed(), secondAttempt);
  }),
);

it.effect("the first settled context answers every later request without building again", () =>
  Effect.gen(function* program() {
    const gated = gatedLayer();
    const runtime = isolateRuntime(gated.layer);
    yield* gated.open;
    const first = yield* Effect.promise(async () => runtime.runPromise(ordinal));
    const later = yield* Effect.promise(async () => runtime.runPromise(ordinal));
    assert.deepStrictEqual([first, later, gated.attempts()], [firstAttempt, firstAttempt, 1]);
    yield* Effect.promise(async () => runtime.dispose());
  }),
);

it.effect("a build that failed is attempted again by the next request", () =>
  Effect.gen(function* program() {
    let attempts = 0;
    const unreachable = "the database is unreachable";
    const built = Effect.suspend(() => {
      attempts += 1;
      return attempts === firstAttempt
        ? Effect.fail(unreachable)
        : Effect.succeed(BuildMark.of({ ordinal: attempts }));
    });
    const runtime = isolateRuntime(Layer.effect(BuildMark, built));
    const failed = yield* Effect.promise(async () => runtime.runPromiseExit(ordinal));
    assert.deepStrictEqual(failed, Exit.fail(unreachable));
    const answered = yield* Effect.promise(async () => runtime.runPromise(ordinal));
    assert.strictEqual(answered, secondAttempt);
    yield* Effect.promise(async () => runtime.dispose());
  }),
);

it.effect("a disposed runtime refuses to answer instead of using released resources", () =>
  Effect.gen(function* program() {
    const gated = gatedLayer();
    const runtime = isolateRuntime(gated.layer);
    yield* gated.open;
    yield* Effect.promise(async () => runtime.runPromise(ordinal));
    yield* Effect.promise(async () => runtime.dispose());
    const exit = yield* Effect.promise(async () => runtime.runPromiseExit(ordinal));
    assert.include(Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "", disposedRuntime);
  }),
);

it.effect("a cached value is kept until its window has passed", () =>
  Effect.gen(function* program() {
    let reads = 0;
    const read = Effect.sync(() => {
      reads += 1;
      return reads;
    });
    const cached = isolateCache(read, Duration.minutes(1));
    assert.deepStrictEqual([yield* cached, yield* cached], [firstAttempt, firstAttempt]);
    yield* TestClock.adjust("1 minute");
    assert.strictEqual(yield* cached, secondAttempt);
  }),
);

it.effect("a second reader runs its own attempt while the first has not settled", () =>
  Effect.gen(function* program() {
    const gate = Latch.makeUnsafe(false);
    let attempts = 0;
    const read = Effect.suspend(() => {
      attempts += 1;
      const attempt = attempts;
      return gate.await.pipe(Effect.as(attempt));
    });
    const cached = isolateCache(read, Duration.minutes(1));
    const both = [Effect.runPromise(cached), Effect.runPromise(cached)];
    yield* Latch.open(gate);
    const settled = yield* Effect.promise(async () => Promise.all(both));
    assert.deepStrictEqual([settled, attempts], [[firstAttempt, secondAttempt], secondAttempt]);
  }),
);

it.effect("an interrupted reader leaves nothing in the cache", () =>
  Effect.gen(function* program() {
    const gate = Latch.makeUnsafe(false);
    let attempts = 0;
    const read = Effect.suspend(() => {
      attempts += 1;
      const attempt = attempts;
      return gate.await.pipe(Effect.as(attempt));
    });
    const cached = isolateCache(read, Duration.minutes(1));
    const running = yield* Effect.forkChild(cached);
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(running);
    yield* Latch.open(gate);
    assert.strictEqual(yield* cached, secondAttempt);
  }),
);
