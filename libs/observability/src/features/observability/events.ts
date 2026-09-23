import { Effect, Schema } from "effect";

import { ErrorLocations, errorTypes } from "./errors.ts";
import { RequestId, SpanId, TraceId, httpMethods } from "./protocol.ts";

export const maximumBatchSize = 32;
const maximumClockSkew = 60_000;
const maximumEventAge = 3_600_000;
const maximumStatus = 599;
const minimumHttpStatus = 100;

export const maximumMeasurement = 600_000;

const Measurement = Schema.Finite.check(
  Schema.isBetween({ maximum: maximumMeasurement, minimum: 0 }),
);
const sharedFields = {
  duration: Measurement,
  method: Schema.Literals(httpMethods),
  requestId: RequestId,
  route: Schema.String,
  spanId: SpanId,
  start: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
  traceId: TraceId,
  value: Measurement,
};
const HttpStatus = Schema.Int.check(
  Schema.isBetween({ maximum: maximumStatus, minimum: minimumHttpStatus }),
);
const Unsent = Schema.Literal(0);
const BrowserEventSchema = Schema.Union([
  Schema.Struct({
    ...sharedFields,
    kind: Schema.Literal("http"),
    name: Schema.Literal("http.client.request"),
    status: Schema.Union([Unsent, HttpStatus]),
  }),
  Schema.Struct({
    ...sharedFields,
    errorType: Schema.Literals(errorTypes),
    kind: Schema.Literal("exception"),
    locations: ErrorLocations,
    name: Schema.Literals(["browser.error", "browser.unhandledrejection"]),
    status: Unsent,
  }),
  Schema.Struct({
    ...sharedFields,
    kind: Schema.Literal("vital"),
    name: Schema.Literals(["CLS", "INP", "LCP", "FCP", "TTFB"]),
    status: Unsent,
  }),
]);
const decodeEvents = Schema.decodeUnknownEffect(
  Schema.Array(BrowserEventSchema).check(Schema.isLengthBetween(1, maximumBatchSize)),
  { onExcessProperty: "error" },
);

export type BrowserEvent = typeof BrowserEventSchema.Type;

class BrowserEventsInvalid extends Schema.TaggedError<BrowserEventsInvalid>()(
  "BrowserEventsInvalid",
  {},
) {}

export const parseBrowserEvents = (received: {
  readonly body: unknown;
  readonly routeLabels: Readonly<ReadonlySet<string>>;
  readonly receivedAt: number;
}): Effect.Effect<readonly BrowserEvent[], BrowserEventsInvalid> => {
  return decodeEvents(received.body).pipe(
    Effect.mapError(() => new BrowserEventsInvalid()),
    Effect.filterOrFail(
      (browserEvents) =>
        browserEvents.every(
          (browserEvent) =>
            received.routeLabels.has(browserEvent.route) &&
            browserEvent.start >= received.receivedAt - maximumEventAge &&
            browserEvent.start <= received.receivedAt + maximumClockSkew,
        ),
      () => new BrowserEventsInvalid(),
    ),
  );
};
