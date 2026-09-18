import { Effect } from "effect";

import { redactedField } from "./redact.ts";

type Attributes = Readonly<Record<string, string | number | boolean>>;

const redacted = (attributes: Attributes): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(attributes).map(
      ([fieldName, fieldValue]: readonly [string, string | number | boolean]) => [
        fieldName,
        redactedField(fieldName, fieldValue),
      ],
    ),
  );

const annotateLogs = (
  attributes: Attributes,
): (<Value, Failure, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
) => Effect.Effect<Value, Failure, Requirements>) => {
  return (effect) => Effect.annotateLogs(effect, redacted(attributes));
};

const annotateSpan = (attributes: Attributes): Effect.Effect<void> =>
  Effect.annotateCurrentSpan(redacted(attributes));

export { annotateLogs, annotateSpan };
export type { Attributes };
