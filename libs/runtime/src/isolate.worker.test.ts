import { assert, describe, it } from "@effect/vitest";
import { Context, Duration, Effect, Exit, Latch, Layer } from "effect";
import { TestClock } from "effect/testing";

import { isolateCache, isolateRuntime } from "./isolate.ts";

const firstBuild = 1;
const secondBuild = 2;

class BuildMark extends Context.Service<BuildMark, { readonly ordinal: number }>()(
  "@repo/runtime/test/BuildMark",
) {}

interface GatedLayer {
  readonly builds: () => number;
  readonly layer: Layer.Layer<BuildMark>;
  readonly open: Effect.Effect<boolean>;
}

function gatedLayer(): GatedLayer {
  const gate = Latch.makeUnsafe(false);
  let started = 0;
  return {
    builds: () => started,
    layer: Layer.effect(
      BuildMark,
      Effect.suspend(() => {
        started += 1;
        const ordinal = started;
        return gate.await.pipe(Effect.as(BuildMark.of({ ordinal })));
      }),
    ),
    open: Latch.open(gate),
  };
}

describe("a runtime shared by one worker isolate", () => {
  it.effect("builds a context per request while no build has settled yet", () =>
    Effect.gen(function* program() {
      const gated = gatedLayer();
      const runtime = isolateRuntime(gated.layer);
      const first = runtime.runPromiseExit(Effect.map(BuildMark, (mark) => mark.ordinal));
      const second = runtime.runPromiseExit(Effect.map(BuildMark, (mark) => mark.ordinal));
      yield* gated.open;
      assert.deepStrictEqual(
        yield* Effect.promise(async () => Promise.all([first, second])),
        [firstBuild, secondBuild].map((ordinal) => Exit.succeed(ordinal)),
      );
      assert.strictEqual(gated.builds(), secondBuild);
      yield* Effect.promise(async () => runtime.dispose());
    }),
  );

  it.effect("reuses the first settled context for every later request", () =>
    Effect.gen(function* program() {
      const gated = gatedLayer();
      const runtime = isolateRuntime(gated.layer);
      const first = runtime.runPromise(Effect.map(BuildMark, (mark) => mark.ordinal));
      yield* gated.open;
      assert.strictEqual(yield* Effect.promise(async () => first), firstBuild);
      assert.strictEqual(
        yield* Effect.promise(async () =>
          runtime.runPromise(Effect.map(BuildMark, (mark) => mark.ordinal)),
        ),
        firstBuild,
      );
      assert.strictEqual(gated.builds(), firstBuild);
      yield* Effect.promise(async () => runtime.dispose());
    }),
  );
});

describe("a value cached for one worker isolate", () => {
  it.effect("keeps a settled result until its window has passed", () =>
    Effect.gen(function* program() {
      let reads = 0;
      const cached = isolateCache(
        Effect.sync(() => {
          reads += 1;
          return reads;
        }),
        Duration.minutes(1),
      );
      assert.strictEqual(yield* cached, firstBuild);
      assert.strictEqual(yield* cached, firstBuild);
      yield* TestClock.adjust("1 minute");
      assert.strictEqual(yield* cached, secondBuild);
    }),
  );

  it.effect("lets a second reader run its own attempt while the first has not settled", () =>
    Effect.gen(function* program() {
      const gate = Latch.makeUnsafe(false);
      let attempts = 0;
      const cached = isolateCache(
        Effect.suspend(() => {
          attempts += 1;
          const attempt = attempts;
          return gate.await.pipe(Effect.as(attempt));
        }),
        Duration.minutes(1),
      );
      const first = Effect.runPromise(cached);
      const second = Effect.runPromise(cached);
      yield* Latch.open(gate);
      assert.deepStrictEqual(yield* Effect.promise(async () => Promise.all([first, second])), [
        firstBuild,
        secondBuild,
      ]);
      assert.strictEqual(attempts, secondBuild);
    }),
  );
});
