import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vite-plus/test";
import type { StrictRequest } from "msw";
import { fetchErrorGroups } from "./telemetry.ts";
import { setupServer } from "msw/node";

interface QueryRequestBody {
  readonly parameters: Readonly<{
    calculations: readonly Readonly<{ operator: string }>[];
    filters: readonly unknown[];
  }>;
  readonly timeframe: Readonly<{ from: number; to: number }>;
  readonly view: string;
}

type QueryRequest = Readonly<Pick<StrictRequest<QueryRequestBody>, "json">> & {
  readonly headers: Readonly<Pick<Headers, "get">>;
};

const ACCOUNT_ID_LENGTH = 32;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
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

function recordQueries(
  record: (body: QueryRequestBody) => void,
): (input: Readonly<{ request: QueryRequest }>) => Promise<Response> {
  return async ({ request }) => {
    if (request.headers.get("authorization") !== `Bearer ${token}`) {
      return new HttpResponse(undefined, { status: UNAUTHORIZED_STATUS });
    }
    record(await request.json());
    return HttpResponse.json(queryResult);
  };
}

describe("workers observability error query", () => {
  it("groups fingerprinted error logs through the Workers Observability query API", async () => {
    expect.hasAssertions();
    const bodies: QueryRequestBody[] = [];
    const handler = recordQueries((body) => {
      bodies.push(body);
    });
    const server = setupServer(http.post<never, QueryRequestBody>(endpoint, handler));
    server.listen({ onUnhandledRequest: "error" });
    try {
      await expect(fetchErrorGroups(window)).resolves.toStrictEqual([
        {
          count: GROUPED_EVENTS,
          event: "application.error",
          fingerprint: "0123abcd",
          service: "user-server",
          type: "RangeError",
        },
      ]);
      const sent = bodies.map((body) => ({
        filters: body.parameters.filters,
        operators: body.parameters.calculations.map((item) => item.operator),
        timeframe: body.timeframe,
        view: body.view,
      }));
      expect(sent).toStrictEqual([
        {
          filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
          operators: ["count"],
          timeframe: { from: 1, to: 2 },
          view: "calculations",
        },
      ]);
    } finally {
      server.close();
    }
  });
});

describe("workers observability query failures", () => {
  it("are errors rather than an empty result", async () => {
    expect.hasAssertions();
    const server = setupServer(
      http.post(endpoint, () =>
        HttpResponse.json({ secret: "must-not-be-logged" }, { status: FORBIDDEN_STATUS }),
      ),
    );
    server.listen({ onUnhandledRequest: "error" });
    try {
      await expect(fetchErrorGroups(window)).rejects.toThrow(/^telemetry_http_failed$/u);
    } finally {
      server.close();
    }
  });
});
