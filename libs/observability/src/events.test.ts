import { assert, describe, it } from "@effect/vitest";
import { maximumBatchSize, parseBrowserEvents } from "./events.ts";
import { Effect } from "effect";

const now = 1_800_000_000_000;
const staleMilliseconds = 4_000_000;
const labels = new Set(["home"]);
const event = {
  duration: 10,
  kind: "http",
  method: "GET",
  name: "http.client.request",
  requestId: "11111111-1111-4111-8111-111111111111",
  route: "home",
  spanId: "bbbbbbbbbbbbbbbb",
  start: now,
  status: 200,
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  value: 0,
};
const exception = {
  ...event,
  errorType: "TypeError",
  kind: "exception",
  locations: "/assets/index-abc.js:1:234\n/assets/auth-def.js:5:6",
  method: "GET",
  name: "browser.error",
  status: 0,
  value: 1,
};

function rejected(input: unknown): Effect.Effect<boolean> {
  return parseBrowserEvents(input, labels, now).pipe(
    Effect.match({ onFailure: () => true, onSuccess: () => false }),
  );
}

function rejectedAll(inputs: readonly unknown[]): Effect.Effect<readonly boolean[]> {
  return Effect.forEach(inputs, rejected);
}

describe("browser ingress events", () => {
  it.effect("accepts a well-formed event", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual<unknown>(yield* parseBrowserEvents([event], labels, now), [event]);
    }),
  );

  it.effect("rejects PII, arbitrary fields, forged labels and unbounded batches", () =>
    Effect.gen(function* program() {
      const results = yield* rejectedAll([
        [{ ...event, profile: "private biography" }],
        [{ ...event, route: "private@example.com" }],
        [{ ...event, name: "Bearer private-token" }],
        [{ ...event, duration: Infinity }],
        [{ ...event, start: now - staleMilliseconds }],
        Array.from({ length: maximumBatchSize + 1 }, () => event),
        [],
      ]);
      assert.isTrue(results.every(Boolean));
    }),
  );
});

describe("browser exception events", () => {
  it.effect("carry only a known error type and bounded stack locations", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual<unknown>(yield* parseBrowserEvents([exception], labels, now), [
        exception,
      ]);
      const { errorType: _type, locations: _locations, ...withoutDetails } = exception;
      const results = yield* rejectedAll([
        [{ ...exception, errorType: "Custom" }],
        [{ ...exception, locations: "private@example.com" }],
        [withoutDetails],
        [{ ...event, errorType: "TypeError" }],
      ]);
      assert.isTrue(results.every(Boolean));
    }),
  );
});
