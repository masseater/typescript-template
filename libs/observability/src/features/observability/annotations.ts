import { Effect, type Tracer } from "effect";

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
const withSpan = (
  spanName: string,
  spanOptions?: Readonly<{
    readonly attributes?: Attributes;
    readonly kind?: Tracer.SpanKind;
    readonly links?: readonly Tracer.SpanLink[];
    readonly parent?: Tracer.AnySpan | undefined;
    readonly root?: boolean;
  }>,
): (<Value, Failure, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
) => Effect.Effect<Value, Failure, Requirements>) => {
  const attributes = spanOptions?.attributes;
  return Effect.withSpan(
    spanName,
    attributes === undefined ? spanOptions : { ...spanOptions, attributes: redacted(attributes) },
  );
};
export { annotateLogs, annotateSpan, withSpan };
export type { Attributes };
