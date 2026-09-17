import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { fetchErrorGroups } from "./telemetry.ts";

const account = "a".repeat(32);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`;

const withServer = (...handlers: Parameters<typeof setupServer>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const server = setupServer(...handlers);
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    (server) => Effect.sync(() => server.close()),
  );

it.effect("groups fingerprinted error logs through the Workers Observability query API", () =>
  Effect.gen(function* () {
    let body: unknown;
    yield* withServer(
      http.post(endpoint, async ({ request }) => {
        if (request.headers.get("authorization") !== "Bearer test-token-000000000000")
          return new HttpResponse(null, { status: 401 });
        body = await request.json();
        return HttpResponse.json({
          success: true,
          errors: [],
          messages: [],
          result: {
            run: {},
            statistics: {},
            calculations: [
              {
                calculation: "count",
                series: [],
                aggregates: [
                  {
                    count: 4,
                    interval: 0,
                    sampleInterval: 1,
                    value: 4,
                    groups: [
                      { key: "error.fingerprint", value: "0123abcd" },
                      { key: "service", value: "user-server" },
                      { key: "event", value: "application.error" },
                      { key: "error.type", value: "RangeError" },
                    ],
                  },
                  {
                    count: 1,
                    interval: 0,
                    sampleInterval: 1,
                    value: 1,
                    groups: [{ key: "error.fingerprint", value: "private@example.com" }],
                  },
                ],
              },
            ],
          },
        });
      }),
    );
    assert.deepStrictEqual(yield* fetchErrorGroups(account, "test-token-000000000000", 1, 2), [
      {
        fingerprint: "0123abcd",
        service: "user-server",
        event: "application.error",
        type: "RangeError",
        count: 4,
      },
    ]);
    assert.deepInclude(body, { timeframe: { from: 1, to: 2 }, view: "calculations" });
    assert.deepNestedInclude(body, {
      "parameters.filters[0]": { key: "error.fingerprint", operation: "exists", type: "string" },
      "parameters.calculations[0].operator": "count",
    });
  }).pipe(Effect.scoped),
);

it.effect("query failures are errors rather than an empty result", () =>
  Effect.gen(function* () {
    yield* withServer(
      http.post(endpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 }),
      ),
    );
    const failure = yield* fetchErrorGroups(account, "test-token-000000000000", 1, 2).pipe(
      Effect.flip,
    );
    assert.strictEqual(failure.code, "telemetry_http_failed");
  }).pipe(Effect.scoped),
);
