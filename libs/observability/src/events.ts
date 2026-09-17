import * as v from "valibot";
import { errorLocationsSchema, errorTypes } from "./errors.ts";
import { httpMethods, requestIdSchema, spanIdSchema, traceIdSchema } from "./protocol.ts";

const bounded = (max: number) => v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(max));

function browserEventsSchema(labels: ReadonlySet<string>, now: number) {
  const fields = {
    route: v.picklist([...labels]),
    start: v.pipe(bounded(now + 60_000), v.minValue(now - 3_600_000)),
    duration: bounded(600_000),
    value: bounded(600_000),
    method: v.picklist(httpMethods),
    traceId: traceIdSchema,
    spanId: spanIdSchema,
    requestId: requestIdSchema,
  };
  return v.pipe(
    v.array(
      v.variant("kind", [
        v.strictObject({
          ...fields,
          kind: v.literal("http"),
          name: v.literal("http.client.request"),
          status: v.union([v.literal(0), v.pipe(bounded(599), v.integer(), v.minValue(100))]),
        }),
        v.strictObject({
          ...fields,
          kind: v.literal("exception"),
          name: v.picklist(["browser.error", "browser.unhandledrejection"]),
          status: v.literal(0),
          errorType: v.picklist(errorTypes),
          locations: errorLocationsSchema,
        }),
        v.strictObject({
          ...fields,
          kind: v.literal("vital"),
          name: v.picklist(["CLS", "INP", "LCP", "FCP", "TTFB"]),
          status: v.literal(0),
        }),
      ]),
    ),
    v.minLength(1),
    v.maxLength(32),
  );
}

export type BrowserEvent = v.InferOutput<ReturnType<typeof browserEventsSchema>>[number];

export function parseBrowserEvents(
  input: unknown,
  labels: ReadonlySet<string>,
  now: number,
): BrowserEvent[] {
  return v.parse(browserEventsSchema(labels, now), input);
}
