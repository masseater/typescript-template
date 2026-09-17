import { ensure, grafana, json, object, poll, string } from "./support.ts";
import type { Browser } from "./browser.ts";
import { assertPrivate, relatedSpans, traceSpans } from "./observation.ts";
import type { ObservedRequest } from "./observation.ts";

async function query(route: string, parameters: Record<string, string>) {
  return json(
    `${grafana}/api/datasources/proxy/uid/${route}?${new URLSearchParams(parameters).toString()}`,
  );
}

export async function verifyCorrelation(
  response: { requestId: unknown; traceparent: unknown },
  service: "user" | "admin",
  forbidden: readonly string[],
  observed?: ObservedRequest,
) {
  const requestId = string(response.requestId);
  const traceparent = string(response.traceparent);
  ensure(/^[0-9a-f-]{36}$/.test(requestId), "E2E_REQUEST_ID_MISSING");
  ensure(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(traceparent), "E2E_TRACE_CONTEXT_MISSING");
  const traceId = traceparent.split("-")[1];
  ensure(traceId, "E2E_TRACE_ID_MISSING");
  const start = String(Math.floor(Date.now() / 1000) - 300);
  await poll(
    async () => {
      const end = String(Math.ceil(Date.now() / 1000));
      const logs = await query("loki/loki/api/v1/query_range", {
        query: `{service_name="${service}-server"} | request_id="${requestId}"`,
        start,
        end,
        limit: "100",
      });
      const serialized = JSON.stringify(logs);
      assertPrivate(logs, forbidden);
      if (!serialized.includes(traceId)) return false;
      const traceResponse = await fetch(
        `${grafana}/api/datasources/proxy/uid/tempo/api/traces/${traceId}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (traceResponse.status === 404) return false;
      ensure(traceResponse.ok, "E2E_TRACE_QUERY_FAILED");
      const traces: unknown = await traceResponse.json();
      const traceText = JSON.stringify(traces);
      assertPrivate(traces, forbidden);
      if (!traceText.includes(`${service}-server`)) return false;
      if (observed && !relatedSpans(traceSpans(traces), observed, service)) return false;
      const metrics = object(
        await query("prometheus/api/v1/query", {
          query: `http_server_request_duration_seconds_count{service_name="${service}-server"}`,
        }),
      );
      const data = object(metrics["data"]);
      assertPrivate(metrics, forbidden);
      if (!Array.isArray(data["result"]) || data["result"].length === 0) return false;
      const exemplars = await query("prometheus/api/v1/query_exemplars", {
        query: `http_server_request_duration_seconds_bucket{service_name="${service}-server"}`,
        start,
        end,
      });
      assertPrivate(exemplars, forbidden);
      if (!JSON.stringify(exemplars).includes(traceId)) return false;
      if (observed?.clientTraceparent) {
        const browserLogs = await query("loki/loki/api/v1/query_range", {
          query: `{service_name="${service}-browser"} | request_id="${requestId}"`,
          start,
          end,
          limit: "100",
        });
        const browserExemplars = await query("prometheus/api/v1/query_exemplars", {
          query: `http_client_request_duration_seconds_bucket{service_name="${service}-browser"}`,
          start,
          end,
        });
        assertPrivate(browserLogs, forbidden);
        assertPrivate(browserExemplars, forbidden);
        if (
          !JSON.stringify(browserLogs).includes(traceId) ||
          !JSON.stringify(browserExemplars).includes(traceId)
        )
          return false;
      }
      return true;
    },
    (complete) => complete,
    "E2E_REAL_LOG_TRACE_METRIC_CORRELATION_MISSING",
    60_000,
  );
}

export async function verifyJourneyTelemetry(
  participants: readonly { browser: Browser; service: "user" | "admin" }[],
  forbidden: readonly string[],
  started: number,
) {
  const observations = await Promise.all(
    participants.map(async ({ browser, service }) => ({
      ...(await browser.finishObservation()),
      service,
    })),
  );
  const secrets = [...new Set([...forbidden, ...observations.flatMap((entry) => entry.secrets)])];
  const requests = new Map<string, { request: ObservedRequest; service: "user" | "admin" }>();
  for (const observation of observations) {
    for (const request of observation.requests)
      requests.set(request.requestId, { request, service: observation.service });
  }
  ensure(requests.size > 0, "E2E_OPERATION_OBSERVATIONS_MISSING");
  ensure(
    [...requests.values()].some(
      ({ request }) => request.path === "/api/auth/sign-up/email" && request.status < 400,
    ),
    "E2E_SIGNUP_OBSERVATION_MISSING",
  );
  ensure(
    [...requests.values()].some(
      ({ request }) => request.path === "/api/auth/verify-email" && request.status < 400,
    ),
    "E2E_EMAIL_VERIFICATION_OBSERVATION_MISSING",
  );
  for (const { request, service } of requests.values())
    await verifyCorrelation(request, service, secrets, request);
  for (const service of new Set(participants.map((participant) => participant.service))) {
    const logs = object(
      await query("loki/loki/api/v1/query_range", {
        query: `{service_name=~"${service}-(server|browser)"}`,
        start: String(started),
        end: String(Math.ceil(Date.now() / 1000)),
        limit: "5000",
      }),
    );
    assertPrivate(logs, secrets);
    const streams = object(logs["data"])["result"];
    ensure(Array.isArray(streams), "E2E_LOG_RESULT_INVALID");
    const entries = streams.reduce((total: number, stream: unknown) => {
      const values = object(stream)["values"];
      ensure(Array.isArray(values), "E2E_LOG_VALUES_INVALID");
      return total + values.length;
    }, 0);
    ensure(entries > 0 && entries < 5000, "E2E_PRIVACY_LOG_WINDOW_INCOMPLETE");
    const metrics = await query("prometheus/api/v1/query", {
      query: `{service_name=~"${service}-(server|browser)"}`,
    });
    assertPrivate(metrics, secrets);
  }
}

export async function verifyBrowserSignals(service: "user" | "admin", start: number) {
  await poll(
    async () => {
      const logs = await query("loki/loki/api/v1/query_range", {
        query: `{service_name="${service}-browser"}`,
        start: String(start),
        end: String(Math.ceil(Date.now() / 1000)),
        limit: "1000",
      });
      const text = JSON.stringify(logs);
      return (
        text.includes("http.client.request") &&
        text.includes("browser.error") &&
        /LCP|FCP|TTFB/.test(text)
      );
    },
    (complete) => complete,
    "E2E_BROWSER_HTTP_EXCEPTION_VITALS_MISSING",
    60_000,
  );
}
