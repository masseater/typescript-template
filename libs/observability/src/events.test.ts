import { describe, expect, it } from "vite-plus/test";
import { maximumBatchSize, parseBrowserEvents } from "./events.ts";
import { ValiError } from "valibot";

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

describe("browser ingress events", () => {
  it("accepts a well-formed event", () => {
    expect.hasAssertions();
    expect(parseBrowserEvents([event], labels, now)).toStrictEqual([event]);
  });

  it("rejects PII, arbitrary fields and forged labels", () => {
    expect.hasAssertions();
    expect(() =>
      parseBrowserEvents([{ ...event, profile: "private biography" }], labels, now),
    ).toThrow(ValiError);
    expect(() =>
      parseBrowserEvents([{ ...event, route: "private@example.com" }], labels, now),
    ).toThrow(ValiError);
    expect(() =>
      parseBrowserEvents([{ ...event, name: "Bearer private-token" }], labels, now),
    ).toThrow(ValiError);
  });

  it("rejects unbounded measurements and batches", () => {
    expect.hasAssertions();
    expect(() => parseBrowserEvents([{ ...event, duration: Infinity }], labels, now)).toThrow(
      ValiError,
    );
    expect(() =>
      parseBrowserEvents([{ ...event, start: now - staleMilliseconds }], labels, now),
    ).toThrow(ValiError);
    const oversized = Array.from({ length: maximumBatchSize + 1 }, () => event);
    expect(() => parseBrowserEvents(oversized, labels, now)).toThrow(ValiError);
  });
});

describe("browser exception events", () => {
  it("carry only a known error type and bounded stack locations", () => {
    expect.hasAssertions();
    expect(parseBrowserEvents([exception], labels, now)).toStrictEqual([exception]);
    expect(() => parseBrowserEvents([{ ...exception, errorType: "Custom" }], labels, now)).toThrow(
      ValiError,
    );
    expect(() =>
      parseBrowserEvents([{ ...exception, locations: "private@example.com" }], labels, now),
    ).toThrow(ValiError);
  });

  it("require error details only on exceptions", () => {
    expect.hasAssertions();
    const withoutDetails = {
      ...event,
      kind: "exception",
      name: "browser.error",
      status: 0,
      value: 1,
    };
    expect(() => parseBrowserEvents([withoutDetails], labels, now)).toThrow(ValiError);
    expect(() => parseBrowserEvents([{ ...event, errorType: "TypeError" }], labels, now)).toThrow(
      ValiError,
    );
  });
});
