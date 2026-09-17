import {
  array,
  finite,
  integer,
  literal,
  maxLength,
  maxValue,
  minLength,
  minValue,
  number,
  object,
  parse,
  picklist,
  pipe,
  strictObject,
  string,
  union,
  variant,
} from "valibot";
import { errorLocationsSchema, errorTypes } from "./errors.ts";
import { httpMethods, requestIdSchema, spanIdSchema, traceIdSchema } from "./protocol.ts";
import type { InferOutput } from "valibot";

const maximumBatchSize = 32;
const maximumMeasurement = 600_000;
const maximumClockSkew = 60_000;
const maximumEventAge = 3_600_000;
const maximumStatus = 599;
const minimumHttpStatus = 100;

const measurement = pipe(number(), finite(), minValue(0), maxValue(maximumMeasurement));
const fields = {
  duration: measurement,
  method: picklist(httpMethods),
  requestId: requestIdSchema,
  route: string(),
  spanId: spanIdSchema,
  start: pipe(number(), finite(), minValue(0)),
  traceId: traceIdSchema,
  value: measurement,
};
const httpStatusSchema = pipe(
  number(),
  integer(),
  minValue(minimumHttpStatus),
  maxValue(maximumStatus),
);
const unsentStatus = literal(0);
const requestStatus = union([unsentStatus, httpStatusSchema]);
const eventSchema = variant("kind", [
  strictObject({
    ...fields,
    kind: literal("http"),
    name: literal("http.client.request"),
    status: requestStatus,
  }),
  strictObject({
    ...fields,
    errorType: picklist(errorTypes),
    kind: literal("exception"),
    locations: errorLocationsSchema,
    name: picklist(["browser.error", "browser.unhandledrejection"]),
    status: literal(0),
  }),
  strictObject({
    ...fields,
    kind: literal("vital"),
    name: picklist(["CLS", "INP", "LCP", "FCP", "TTFB"]),
    status: literal(0),
  }),
]);
const eventsSchema = pipe(array(eventSchema), minLength(1), maxLength(maximumBatchSize));

type BrowserEvent = InferOutput<typeof eventSchema>;

function parseBrowserEvents(
  input: unknown,
  labels: Readonly<ReadonlySet<string>>,
  now: number,
): BrowserEvent[] {
  const events = parse(eventsSchema, input);
  const placement = object({
    route: picklist([...labels]),
    start: pipe(number(), minValue(now - maximumEventAge), maxValue(now + maximumClockSkew)),
  });
  parse(array(placement), events);
  return events;
}

export { maximumBatchSize, maximumMeasurement, parseBrowserEvents };
export type { BrowserEvent };
