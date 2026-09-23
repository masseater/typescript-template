import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { OnboardingAdvance, OnboardingStep } from "./social.ts";

const decodeAdvance = Schema.decodeUnknownEffect(OnboardingAdvance);

describe("onboarding advance request", () => {
  it.effect("accepts every step after the agreement as a target", () =>
    Effect.gen(function* program() {
      const targets = OnboardingStep.literals.filter((step) => step !== "agreement");
      const decoded = yield* Effect.forEach(targets, (step) => decodeAdvance({ step }));
      assert.deepStrictEqual(
        decoded,
        targets.map((step) => ({ step })),
      );
    }),
  );

  it.effect("refuses to advance back to the agreement step every member starts on", () =>
    Effect.gen(function* program() {
      const refusal = yield* Effect.flip(decodeAdvance({ step: "agreement" }));
      assert.instanceOf(refusal, Schema.SchemaError);
    }),
  );
});
