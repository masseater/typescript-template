import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { maximumBatchSize, parseBrowserEvents } from "./events.ts";

const receivedAt = 1_800_000_000_000;
const routeLabels = new Set(["home"]);
const httpEvent = {
  duration: 10,
  kind: "http",
  method: "GET",
  name: "http.client.request",
  requestId: "11111111-1111-4111-8111-111111111111",
  route: "home",
  spanId: "bbbbbbbbbbbbbbbb",
  start: receivedAt,
  status: 200,
  traceId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  value: 0,
};
const exceptionEvent = {
  ...httpEvent,
  errorType: "TypeError",
  kind: "exception",
  locations: "/assets/index-abc.js:1:234\n/assets/auth-def.js:5:6",
  name: "browser.error",
  status: 0,
  value: 1,
};

describe("parseBrowserEvents", () => {
  describe.for([
    ["a well-formed request event", httpEvent],
    ["a well-formed exception event", exceptionEvent],
  ] as const)("%s", ([, browserEvent]) => {
    const it = test.extend("parsedEvents", async () =>
      Effect.runPromise(parseBrowserEvents({ body: [browserEvent], receivedAt, routeLabels })));

    it("is accepted unchanged", ({ parsedEvents }) => {
      expect(parsedEvents).toStrictEqual([browserEvent]);
    });
  });

  describe.for([
    ["a field the schema does not know", [{ ...httpEvent, profile: "private biography" }]],
    ["a route label the server did not issue", [{ ...httpEvent, route: "private@example.com" }]],
    ["a forged event name", [{ ...httpEvent, name: "Bearer private-token" }]],
    ["an unbounded duration", [{ ...httpEvent, duration: Infinity }]],
    ["a start older than an hour", [{ ...httpEvent, start: receivedAt - 4_000_000 }]],
    ["a batch over the limit", Array.from({ length: maximumBatchSize + 1 }, () => httpEvent)],
    ["an empty batch", []],
    ["an error type nobody declared", [{ ...exceptionEvent, errorType: "Custom" }]],
    [
      "stack locations carrying an address",
      [{ ...exceptionEvent, locations: "private@example.com" }],
    ],
    [
      "an exception without its details",
      [{ ...httpEvent, kind: "exception", name: "browser.error", status: 0 }],
    ],
    ["an error type on a request event", [{ ...httpEvent, errorType: "TypeError" }]],
  ] as const)("a batch carrying %s", ([, batch]) => {
    const it = test.extend("parseSucceeded", async () => {
      const parseExit = await Effect.runPromiseExit(
        parseBrowserEvents({ body: batch, receivedAt, routeLabels }),
      );
      return parseExit._tag === "Success";
    });

    it("is refused", ({ parseSucceeded }) => {
      expect(parseSucceeded).toBe(false);
    });
  });
});
