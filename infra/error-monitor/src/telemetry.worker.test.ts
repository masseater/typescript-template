import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Effect, Schema } from "effect";
import { HttpResponse, http } from "msw";

import { fetchErrorGroups } from "./telemetry.ts";

import type { Scope } from "effect";

type Network = ReturnType<typeof setupNetwork>;

type RequestParams = Record<string, string>;
interface AskedQuery {
  readonly chartType: string;
  readonly ignoreSeries: boolean;
  readonly limit: number;
  readonly offsetBy: number;
  readonly parameters: {
    readonly groupBys: readonly { readonly value: string }[];
    readonly limit: number;
  };
}

const ACCOUNT_ID_LENGTH = 32;
const GROUPED_EVENTS = 4;

const account = "a".repeat(ACCOUNT_ID_LENGTH);
const token = "test-token-000000000000";
const window = { accountId: account, from: 1, to: 2, token };
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`;
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
};
const personalAggregate = {
  count: 1,
  groups: [{ key: "error.fingerprint", value: "private@example.com" }],
  interval: 0,
  sampleInterval: 1,
  value: 1,
};
const queryResult = {
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
};

function withServer(
  ...handlers: Parameters<Network["use"]>
): Effect.Effect<Network, never, Scope.Scope> {
  return Effect.acquireRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(...handlers);
      network.enable();
      return network;
    }),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

function recordQuery(requests: unknown[]): Effect.Effect<Network, never, Scope.Scope> {
  return withServer(
    http.post(endpoint, ({ request }) => {
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      return request.json().then((body) => {
        requests.push(body);
        return HttpResponse.json(queryResult);
      });
    }),
  );
}

it.effect("groups fingerprinted error logs through the Workers Observability query API", () =>
  Effect.gen(function* program() {
    const requests: unknown[] = [];
    yield* recordQuery(requests);
    const result = yield* fetchErrorGroups(window);
    assert.deepStrictEqual(result, {
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
    assert.notInclude(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(result),
      "private@example.com",
    );
    const [body] = requests;
    assert.deepInclude(body, {
      chartType: "aggregate",
      ignoreSeries: true,
      timeframe: { from: window.from, to: window.to },
      view: "calculations",
    });
    assert.deepNestedInclude(body, {
      "parameters.calculations[0].operator": "count",
      "parameters.filters[0]": { key: "error.fingerprint", operation: "exists", type: "string" },
      "parameters.groupBys": [
        { type: "string", value: "error.fingerprint" },
        { type: "string", value: "service" },
        { type: "string", value: "event" },
        { type: "string", value: "error.tag" },
        { type: "string", value: "error.type" },
      ],
    });
  }).pipe(Effect.scoped),
);

it.effect("a response without the calculations key is an error rather than zero errors", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.post(endpoint, () =>
        HttpResponse.json({ ...queryResult, result: { run: {}, statistics: {} } }),
      ),
    );
    const failure = yield* fetchErrorGroups(window).pipe(Effect.flip);
    assert.strictEqual(failure.code, "telemetry_response_invalid");
    assert.isTrue(failure.keys.some((key) => key.includes("calculations")));
  }).pipe(Effect.scoped),
);

it.effect("pages grouped results past the query limit instead of treating them as truncated", () =>
  Effect.gen(function* program() {
    const requests: AskedQuery[] = [];
    yield* withServer(
      http.post<RequestParams, AskedQuery>(endpoint, ({ request }) =>
        request.json().then((body) => {
          requests.push(body);
          const start = body.offsetBy;
          const pageSize = body.limit;
          return HttpResponse.json({
            ...queryResult,
            result: {
              ...queryResult.result,
              calculations: [
                {
                  aggregates: Array.from(
                    { length: start === 0 ? pageSize : 1 },
                    (_unused, index) => ({
                      ...fingerprintedAggregate,
                      groups: [
                        {
                          key: "error.fingerprint",
                          value: (start + index).toString(16).padStart(8, "0"),
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
      ),
    );
    const result = yield* fetchErrorGroups(window);
    const pageSize = requests[0]?.limit;
    assert.isTrue(pageSize !== undefined && pageSize > 0);
    assert.strictEqual(result.groups.length, (pageSize ?? 0) + 1);
    assert.strictEqual(result.dropped, 0);
    assert.deepStrictEqual(
      requests.map((request) => request.offsetBy),
      [0, pageSize],
    );
    assert.isTrue(requests.every((request) => request.limit === pageSize));
    assert.isTrue(requests.every((request) => request.parameters.limit === pageSize));
  }).pipe(Effect.scoped),
);

it.effect("reports a group value the query did not return as absent", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.post(endpoint, () =>
        HttpResponse.json({
          ...queryResult,
          result: {
            ...queryResult.result,
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
    assert.deepStrictEqual(yield* fetchErrorGroups(window), {
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
  }).pipe(Effect.scoped),
);

it.effect("query failures are errors rather than an empty result", () =>
  Effect.gen(function* program() {
    yield* withServer(
      http.post(endpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 }),
      ),
    );
    const failure = yield* fetchErrorGroups(window).pipe(Effect.flip);
    assert.strictEqual(failure.code, "telemetry_http_failed");
    assert.deepStrictEqual(failure.keys, []);
  }).pipe(Effect.scoped),
);
