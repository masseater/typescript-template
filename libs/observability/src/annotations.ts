import { Effect } from "effect";

import { redactedField } from "./redact.ts";

type Attributes = Readonly<Record<string, string | number | boolean>>;

function redacted(attributes: Attributes): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]: readonly [string, string | number | boolean]) => [
      key,
      redactedField(key, value),
    ]),
  );
}

function annotateLogs(
  attributes: Attributes,
): <Value, Error, Requirements>(
  effect: Effect.Effect<Value, Error, Requirements>,
) => Effect.Effect<Value, Error, Requirements> {
  return (effect) => Effect.annotateLogs(effect, redacted(attributes));
}

function annotateSpan(attributes: Attributes): Effect.Effect<void> {
  return Effect.annotateCurrentSpan(redacted(attributes));
}

export { annotateLogs, annotateSpan };
export type { Attributes };
