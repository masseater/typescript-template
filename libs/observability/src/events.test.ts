import { describe, expect, it } from "vite-plus/test";
import { maximumBatchSize, parseBrowserEvents } from "./events.ts";

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

describe("browser ingress events", () => {
  it("accepts a well-formed event", () => {
    expect.hasAssertions();
    expect(parseBrowserEvents([event], labels, now)).toStrictEqual([event]);
  });

  it("rejects PII, arbitrary fields and forged labels", () => {
    expect.hasAssertions();
    expect(() =>
      parseBrowserEvents([{ ...event, profile: "private biography" }], labels, now),
    ).toThrow("fields");
    expect(() =>
      parseBrowserEvents([{ ...event, route: "private@example.com" }], labels, now),
    ).toThrow("value");
    expect(() =>
      parseBrowserEvents([{ ...event, name: "Bearer private-token" }], labels, now),
    ).toThrow("event");
  });

  it("rejects unbounded measurements and batches", () => {
    expect.hasAssertions();
    expect(() => parseBrowserEvents([{ ...event, duration: Infinity }], labels, now)).toThrow(
      "value",
    );
    expect(() =>
      parseBrowserEvents([{ ...event, start: now - staleMilliseconds }], labels, now),
    ).toThrow("value");
    const oversized = Array.from({ length: maximumBatchSize + 1 }, () => event);
    expect(() => parseBrowserEvents(oversized, labels, now)).toThrow("batch");
  });
});
