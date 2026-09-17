import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { expect, test } from "vitest";
import { fetchErrorGroups } from "./telemetry.ts";
import { postWebhook } from "./webhook.ts";

const account = "a".repeat(32);
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`;

test("groups fingerprinted error logs through the Workers Observability query API", async () => {
  let body: unknown;
  const server = setupServer(
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
  server.listen({ onUnhandledRequest: "error" });
  try {
    expect(await fetchErrorGroups(account, "test-token-000000000000", 1, 2)).toEqual([
      {
        fingerprint: "0123abcd",
        service: "user-server",
        event: "application.error",
        type: "RangeError",
        count: 4,
      },
    ]);
    expect(body).toMatchObject({
      timeframe: { from: 1, to: 2 },
      view: "calculations",
      parameters: {
        filters: [{ key: "error.fingerprint", operation: "exists", type: "string" }],
        calculations: [{ operator: "count" }],
      },
    });
  } finally {
    server.close();
  }
});

test("query failures are errors rather than an empty result", async () => {
  const server = setupServer(
    http.post(endpoint, () => HttpResponse.json({ secret: "must-not-be-logged" }, { status: 403 })),
  );
  server.listen({ onUnhandledRequest: "error" });
  try {
    await expect(fetchErrorGroups(account, "test-token-000000000000", 1, 2)).rejects.toThrow(
      /^telemetry_http_failed$/,
    );
  } finally {
    server.close();
  }
});

test("webhooks receive Slack-compatible text and reject unsuccessful deliveries", async () => {
  let received: unknown;
  const server = setupServer(
    http.post("https://hooks.example.test/ok", async ({ request }) => {
      received = await request.json();
      return new HttpResponse("ok");
    }),
    http.post("https://hooks.example.test/gone", () => new HttpResponse(null, { status: 404 })),
  );
  server.listen({ onUnhandledRequest: "error" });
  try {
    await postWebhook("https://hooks.example.test/ok", "検出しました");
    expect(received).toEqual({ text: "検出しました" });
    await expect(postWebhook("https://hooks.example.test/gone", "x")).rejects.toThrow(
      "webhook_http_failed",
    );
  } finally {
    server.close();
  }
});
