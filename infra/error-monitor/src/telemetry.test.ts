import { Effect, Ref } from "effect";
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

describe("the query sent for one window", () => {
  const it = test.extend("askedQueries", async ({}, { onCleanup }) => {
    const askedBodies = Effect.runSync(Ref.make<readonly unknown[]>([]));
    const telemetryApi = setupServer(
      http.post(queryEndpoint, async ({ request }) => {
        const askedBody: unknown = await request.json();
        await Effect.runPromise(Ref.update(askedBodies, (earlier) => [...earlier, askedBody]));
        return HttpResponse.json(telemetryEnvelope);
      }),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(
      fetchErrorGroups(queryWindow).pipe(Effect.andThen(Ref.get(askedBodies))),
    );
  });

  it("asks for fingerprinted error counts grouped by every reported field", ({ askedQueries }) => {
    expect(askedQueries).toStrictEqual([
      {
        chartType: "aggregate",
        ignoreSeries: true,
        limit: 2000,
        offsetBy: 0,
        parameters: {
          calculations: [{ alias: "events", operator: "count" }],
          datasets: [],
          filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
          groupBys: [
            { type: "string", value: "error.fingerprint" },
            { type: "string", value: "service" },
            { type: "string", value: "event" },
            { type: "string", value: "error.tag" },
            { type: "string", value: "error.type" },
          ],
          limit: 2000,
        },
        queryId: "error-monitor",
        timeframe: { from: queryWindow.from, to: queryWindow.to },
        view: "calculations",
      },
    ]);
  });
});

describe("grouped results past the query limit", () => {
  const it = test.extend("pagedQuery", async ({}, { onCleanup }) => {
    const askedPages = Effect.runSync(
      Ref.make<
        readonly {
          readonly limit: number;
          readonly offsetBy: number;
          readonly parameters: { readonly limit: number };
        }[]
      >([]),
    );
    const telemetryApi = setupServer(
      http.post<
        Record<string, string>,
        {
          readonly limit: number;
          readonly offsetBy: number;
          readonly parameters: { readonly limit: number };
        }
      >(queryEndpoint, async ({ request }) => {
        const askedPage = await request.json();
        await Effect.runPromise(
          Ref.update(askedPages, (earlier) => [
            ...earlier,
            {
              limit: askedPage.limit,
              offsetBy: askedPage.offsetBy,
              parameters: { limit: askedPage.parameters.limit },
            },
          ]),
        );
        return HttpResponse.json({
          ...telemetryEnvelope,
          result: {
            ...telemetryEnvelope.result,
            calculations: [
              {
                aggregates: Array.from(
                  { length: askedPage.offsetBy === 0 ? askedPage.limit : 1 },
                  (_unused, pageIndex) => ({
                    ...fingerprintedAggregate,
                    groups: [
                      {
                        key: "error.fingerprint",
                        value: (askedPage.offsetBy + pageIndex).toString(16).padStart(8, "0"),
                      },
                      { key: "error.tag", value: "Overflow" },
                    ],
                  }),
                ),
                calculation: "count",
                series: [],
              },
            ],
          },
        });
      }),
    );
    telemetryApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      telemetryApi.close();
    });
    return Effect.runPromise(
      Effect.all({
        observedGroups: fetchErrorGroups(queryWindow),
        sentPages: Ref.get(askedPages),
      }),
    );
  });

  it("keeps every group and asks for the next page at the same size instead of truncating", ({
    pagedQuery,
  }) => {
    expect(pagedQuery).toStrictEqual({
      observedGroups: {
        dropped: 0,
        groups: Array.from({ length: 2001 }, (_unused, groupIndex) => ({
          count: GROUPED_EVENTS,
          event: undefined,
          fingerprint: groupIndex.toString(16).padStart(8, "0"),
          service: undefined,
          tag: "Overflow",
          type: undefined,
        })),
      },
      sentPages: [
        { limit: 2000, offsetBy: 0, parameters: { limit: 2000 } },
        { limit: 2000, offsetBy: 2000, parameters: { limit: 2000 } },
      ],
    });
  });
});
