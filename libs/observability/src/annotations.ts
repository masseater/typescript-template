import { Effect } from "effect";

import { redactedField } from "./redact.ts";

import type { Tracer } from "effect";

type Attributes = Readonly<Record<string, string | number | boolean>>;

type SpanOptions = {
  readonly attributes?: Attributes;
  readonly kind?: Tracer.SpanKind;
  readonly links?: readonly Tracer.SpanLink[];
  readonly parent?: Tracer.AnySpan | undefined;
  readonly root?: boolean;
};

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

function withSpan(
  name: string,
  options?: SpanOptions,
): <Value, Error, Requirements>(
  effect: Effect.Effect<Value, Error, Requirements>,
) => Effect.Effect<Value, Error, Requirements> {
  const attributes = options?.attributes;
  return Effect.withSpan(
    name,
    attributes === undefined ? options : { ...options, attributes: redacted(attributes) },
  );
}

export { annotateLogs, annotateSpan, withSpan };
export type { Attributes };
