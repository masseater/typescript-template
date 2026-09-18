import { assert, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";

import { AlertEnvironment } from "./index.ts";

const TOO_MANY_RECIPIENTS = 11;

const decode = Schema.decodeUnknownEffect(AlertEnvironment);

it.effect("splits verified operator addresses", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(
      yield* decode({
        ALERT_FROM: "alerts@example.com",
        ALERT_TO: "operator@example.com,oncall@example.com",
      }),
      {
        ALERT_FROM: "alerts@example.com",
        ALERT_TO: ["operator@example.com", "oncall@example.com"],
      },
    );
  }),
);

for (const input of [
  { ALERT_FROM: "alerts@example.com", ALERT_TO: "private-not-an-address" },
  { ALERT_FROM: "", ALERT_TO: "operator@example.com" },
  {
    ALERT_FROM: "alerts@example.com",
    ALERT_TO: Array.from(
      { length: TOO_MANY_RECIPIENTS },
      (_unused, index) => `operator${index}@example.com`,
    ).join(","),
  },
]) {
  it.effect(`refuses invalid alert addresses: ${JSON.stringify(input)}`, () =>
    Effect.gen(function* program() {
      const outcome = yield* Effect.exit(decode(input));
      assert.isTrue(Exit.isFailure(outcome));
    }),
  );
}
