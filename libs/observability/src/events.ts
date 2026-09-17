import { Schema } from "effect";
import { errorTypes, validErrorLocations } from "./errors.ts";
import { validRequestId, validSpanId, validTraceId } from "./protocol.ts";

const bounded = (max: number) =>
  Schema.Number.check(Schema.isFinite(), Schema.isBetween({ minimum: 0, maximum: max }));

const guarded = (guard: (value: unknown) => boolean) =>
  Schema.String.check(Schema.makeFilter((value: string) => guard(value)));

const fields = (labels: ReadonlySet<string>, now: number) => ({
  route: Schema.String.check(Schema.makeFilter((value: string) => labels.has(value))),
  start: bounded(now + 60_000).check(Schema.isGreaterThanOrEqualTo(now - 3_600_000)),
  duration: bounded(600_000),
  value: bounded(600_000),
  method: Schema.Literals(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "_OTHER"]),
  traceId: guarded(validTraceId),
  spanId: guarded(validSpanId),
  requestId: guarded(validRequestId),
});

export const browserEvents = (labels: ReadonlySet<string>, now: number) => {
  const common = fields(labels, now);
  return Schema.Array(
    Schema.Union([
      Schema.Struct({
        ...common,
        kind: Schema.Literal("http"),
        name: Schema.Literal("http.client.request"),
        status: Schema.Int.check(
          Schema.isBetween({ minimum: 0, maximum: 599 }),
          Schema.makeFilter((value: number) => value === 0 || value >= 100),
        ),
      }),
      Schema.Struct({
        ...common,
        kind: Schema.Literal("exception"),
        name: Schema.Literals(["browser.error", "browser.unhandledrejection"]),
        status: Schema.Literal(0),
        errorType: Schema.Literals(errorTypes),
        locations: guarded(validErrorLocations),
      }),
      Schema.Struct({
        ...common,
        kind: Schema.Literal("vital"),
        name: Schema.Literals(["CLS", "INP", "LCP", "FCP", "TTFB"]),
        status: Schema.Literal(0),
      }),
    ]),
  ).check(Schema.isLengthBetween(1, 32));
};

export type BrowserEvent = ReturnType<typeof browserEvents>["Type"][number];
