import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { ErrorMonitorFailure, observabilityQueryEndpoint } from "./config.ts";
import { fetchErrorGroups } from "./telemetry.ts";

const ACCOUNT_ID_LENGTH = 32;
const GROUPED_EVENTS = 4;

const accountId = "a".repeat(ACCOUNT_ID_LENGTH);
const token = "test-token-000000000000";
const queryEndpoint = observabilityQueryEndpoint(accountId);
const queryWindow = {
  accountId,
  from: 1,
  queryEndpoint,
  to: 2,
  token,
};

const fingerprintedAggregate = {
  count: GROUPED_EVENTS,
  groups: [
    { key: "error.fingerprint", value: "0123abcd" },
    { key: "service", value: "service-member-server" },
    { key: "event", value: "application.error" },
    { key: "error.tag", value: "RangeError" },
    { key: "error.type", value: "Error" },
  ],
  interval: 0,
  sampleInterval: 1,
  value: GROUPED_EVENTS,
} as const;

const personalAggregate = {
  count: 1,
  groups: [{ key: "error.fingerprint", value: "private@example.com" }],
  interval: 0,
  sampleInterval: 1,
  value: 1,
} as const;

const telemetryEnvelope = {
  errors: [],
  messages: [],
  result: {
    calculations: [
      {
        aggregates: [fingerprintedAggregate, personalAggregate],
        calculation: "count",
        series: [{ data: [1], time: [1] }],
      },
    ],
    run: {},
    statistics: {},
  },
  success: true,
} as const;

describe("fetchErrorGroups", () => {
  const it = test.extend("observedGroups", ({}, { onCleanup }) => {
    const telemetryApi = setupServer(
      http.post(queryEndpoint, ({ request }) => {
        if (request.headers.get("authorization") !== `Bearer ${token}`) {
          return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        return HttpResponse.json(telemetryEnvelope);
      }),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(fetchErrorGroups(queryWindow));
  });

  it("groups fingerprinted error logs through the Workers Observability query API", ({
    observedGroups,
  }) => {
    expect(observedGroups).toStrictEqual({
      dropped: 1,
      groups: [
        {
          count: GROUPED_EVENTS,
          event: "application.error",
          fingerprint: "0123abcd",
          service: "service-member-server",
          tag: "RangeError",
          type: "Error",
        },
      ],
    });
  });
});

describe("a response without calculations", () => {
  const it = test.extend("queryFailure", ({}, { onCleanup }) => {
    const telemetryApi = setupServer(
      http.post(queryEndpoint, () =>
        HttpResponse.json({ ...telemetryEnvelope, result: { run: {}, statistics: {} } }),
      ),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(Effect.flip(fetchErrorGroups(queryWindow)));
  });

  it("fails rather than returning zero errors", ({ queryFailure }) => {
    expect(queryFailure).toStrictEqual(
      new ErrorMonitorFailure({ code: "telemetry_response_invalid", keys: [] }),
    );
  });
});

describe("authorization failure", () => {
  const it = test.extend("queryFailure", ({}, { onCleanup }) => {
    const telemetryApi = setupServer(
      http.post(queryEndpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 }),
      ),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(Effect.flip(fetchErrorGroups(queryWindow)));
  });

  it("fails closed without carrying the provider body", ({ queryFailure }) => {
    expect(queryFailure).toStrictEqual(
      new ErrorMonitorFailure({ code: "telemetry_http_failed", keys: [] }),
    );
  });
});

describe("a group with only a fingerprint", () => {
  const it = test.extend("observedGroups", ({}, { onCleanup }) => {
    const telemetryApi = setupServer(
      http.post(queryEndpoint, () =>
        HttpResponse.json({
          ...telemetryEnvelope,
          result: {
            ...telemetryEnvelope.result,
            calculations: [
              {
                aggregates: [
                  {
                    ...fingerprintedAggregate,
                    groups: [{ key: "error.fingerprint", value: "0123abcd" }],
                  },
                ],
                calculation: "count",
                series: [],
              },
            ],
          },
        }),
      ),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(fetchErrorGroups(queryWindow));
  });

  it("reports absent fields as undefined", ({ observedGroups }) => {
    expect(observedGroups).toStrictEqual({
      dropped: 0,
      groups: [
        {
          count: GROUPED_EVENTS,
          event: undefined,
          fingerprint: "0123abcd",
          service: undefined,
          tag: undefined,
          type: undefined,
        },
      ],
    });
  });
});
