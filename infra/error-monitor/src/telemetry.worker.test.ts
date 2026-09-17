import { HttpResponse, http } from "msw";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import type { Scope } from "effect";
import { fetchErrorGroups } from "./telemetry.ts";
import { setupNetwork } from "@msw/cloudflare";

type Network = ReturnType<typeof setupNetwork>;

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
    { key: "service", value: "user-server" },
    { key: "event", value: "application.error" },
    { key: "error.type", value: "RangeError" },
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
        series: [],
      },
    ],
    run: {},
    statistics: {},
  },
  success: true,
};

function withServer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function recordQuery(requests: unknown[]): Effect.Effect<Network, never, Scope.Scope> {
  return withServer(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    http.post(endpoint, async ({ request }) => {
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      requests.push(await request.json());
      return HttpResponse.json(queryResult);
    }),
  );
}

it.effect("groups fingerprinted error logs through the Workers Observability query API", () =>
  Effect.gen(function* program() {
    const requests: unknown[] = [];
    yield* recordQuery(requests);
    assert.deepStrictEqual(yield* fetchErrorGroups(window), [
      {
        count: GROUPED_EVENTS,
        event: "application.error",
        fingerprint: "0123abcd",
        service: "user-server",
        type: "RangeError",
      },
    ]);
    const [body] = requests;
    assert.deepInclude(body, {
      timeframe: { from: window.from, to: window.to },
      view: "calculations",
    });
    assert.deepNestedInclude(body, {
      "parameters.calculations[0].operator": "count",
      "parameters.filters[0]": { key: "error.fingerprint", operation: "exists", type: "string" },
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
  }).pipe(Effect.scoped),
);
