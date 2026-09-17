import { Effect, Schema } from "effect";
import { ErrorLocations, errorTypes } from "./errors.ts";
import { RequestId, SpanId, TraceId, httpMethods } from "./protocol.ts";

const maximumBatchSize = 32;
const maximumMeasurement = 600_000;
const maximumClockSkew = 60_000;
const maximumEventAge = 3_600_000;
const maximumStatus = 599;
const minimumHttpStatus = 100;

const Measurement = Schema.Number.check(
  Schema.isFinite(),
  Schema.isBetween({ maximum: maximumMeasurement, minimum: 0 }),
);
const fields = {
  duration: Measurement,
  method: Schema.Literals(httpMethods),
  requestId: RequestId,
  route: Schema.String,
  spanId: SpanId,
  start: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)),
  traceId: TraceId,
  value: Measurement,
};
const HttpStatus = Schema.Int.check(
  Schema.isBetween({ maximum: maximumStatus, minimum: minimumHttpStatus }),
);
const Unsent = Schema.Literal(0);
const HttpEvent = Schema.Struct({
  ...fields,
  kind: Schema.Literal("http"),
  name: Schema.Literal("http.client.request"),
  status: Schema.Union([Unsent, HttpStatus]),
});
const ExceptionEvent = Schema.Struct({
  ...fields,
  errorType: Schema.Literals(errorTypes),
  kind: Schema.Literal("exception"),
  locations: ErrorLocations,
  name: Schema.Literals(["browser.error", "browser.unhandledrejection"]),
  status: Unsent,
});
const VitalEvent = Schema.Struct({
  ...fields,
  kind: Schema.Literal("vital"),
  name: Schema.Literals(["CLS", "INP", "LCP", "FCP", "TTFB"]),
  status: Unsent,
});
const BrowserEventSchema = Schema.Union([HttpEvent, ExceptionEvent, VitalEvent]);
const BrowserEvents = Schema.Array(BrowserEventSchema).check(
  Schema.isLengthBetween(1, maximumBatchSize),
);
const decodeEvents = Schema.decodeUnknownEffect(BrowserEvents, { onExcessProperty: "error" });

type BrowserEvent = typeof BrowserEventSchema.Type;

class BrowserEventsInvalid extends Schema.TaggedError<BrowserEventsInvalid>()(
  "BrowserEventsInvalid",
  {},
) {}

function placed(
  events: readonly BrowserEvent[],
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): boolean {
  return events.every(
    (event) =>
      labels.has(event.route) &&
      event.start >= now - maximumEventAge &&
      event.start <= now + maximumClockSkew,
  );
}

function parseBrowserEvents(
  input: unknown,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): Effect.Effect<readonly BrowserEvent[], BrowserEventsInvalid> {
  return decodeEvents(input).pipe(
    Effect.mapError(() => new BrowserEventsInvalid()),
    Effect.filterOrFail(
      (events) => placed(events, labels, now),
      () => new BrowserEventsInvalid(),
    ),
  );
}

export { maximumBatchSize, maximumMeasurement, parseBrowserEvents };
export type { BrowserEvent };
