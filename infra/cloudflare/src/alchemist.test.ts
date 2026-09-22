import { assert, it } from "@effect/vitest";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { layer as alchemistRuntime } from "alchemy/Alchemist";
import { Effect } from "effect";

import { layer } from "./alchemist.ts";

it.effect("turns on state-store recovery for every Alchemist call site", () =>
  Effect.gen(function* program() {
    const context = yield* AlchemyContext;
    assert.isTrue(context.updateStateStore);
    assert.isFalse(context.adopt);
    assert.isFalse(context.dev);
  }).pipe(Effect.provide(layer()), Effect.scoped),
);

it.effect("differs from Alchemy's default Alchemist layer", () =>
  Effect.gen(function* program() {
    const restored = yield* AlchemyContext.pipe(
      Effect.provide(alchemistRuntime()),
      Effect.scoped,
    );
    assert.isFalse(restored.updateStateStore);
  }),
);
