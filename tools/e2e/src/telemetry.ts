import { request as httpRequest } from "node:http";
import { ensure, object, poll, string } from "./support.ts";
import type { Browser } from "./browser.ts";
import { assertPrivate, explorerQuery, relatedSpans, structuredEvent } from "./observation.ts";
import type { ObservedRequest } from "./observation.ts";

type Service = "user" | "admin" | "wiki";

async function requestTelemetry(origin: string, requestId: string) {
  const pattern = `request_id\\":\\"${requestId}`;
  const logs = await explorerQuery(
    origin,
    "SELECT trace_id, span_id, level, message FROM logs WHERE instr(message, ?) > 0 ORDER BY ts_ms",
    [pattern],
  );
  const spans = await explorerQuery(
    origin,
    "SELECT trace_id, span_id, parent_id, name, kind, duration_ms, outcome, json(attributes) AS attributes FROM spans WHERE trace_id IN (SELECT trace_id FROM logs WHERE instr(message, ?) > 0) ORDER BY start_ms",
    [pattern],
  );
  return { logs, spans };
}

export async function verifyCorrelation(
  origin: string,
  response: { requestId: unknown; traceparent: unknown },
  service: Service,
  forbidden: readonly string[],
  observed?: ObservedRequest,
) {
  const requestId = string(response.requestId);
  const traceparent = string(response.traceparent);
  ensure(/^[0-9a-f-]{36}$/.test(requestId), "E2E_REQUEST_ID_MISSING");
  ensure(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/.test(traceparent), "E2E_TRACE_CONTEXT_MISSING");
  await poll(
    async () => {
      const telemetry = await requestTelemetry(origin, requestId);
      assertPrivate(telemetry, forbidden);
      const events = telemetry.logs.map((row) => structuredEvent(row["message"]));
      const server = events.find(
        (event) =>
          event?.["event"] === "http.server.request" &&
          event["service"] === `${service}-server` &&
          event["request_id"] === requestId &&
          event["trace_id"] === traceparent.split("-")[1],
      );
      if (!server) return false;
      if (
        !telemetry.spans.some((span) => span["parent_id"] === null && span["duration_ms"] !== null)
      )
        return false;
      if (observed && !relatedSpans(telemetry.spans, events, observed, service)) return false;
      return true;
    },
    (complete) => complete,
    "E2E_REAL_LOG_TRACE_CORRELATION_MISSING",
    60_000,
  );
}

export async function verifyJourneyTelemetry(
  participants: readonly { browser: Browser; service: Service; origin: string }[],
  forbidden: readonly string[],
  startedMs: number,
) {
  const observations = await Promise.all(
    participants.map(async ({ browser, service, origin }) => ({
      ...(await browser.finishObservation()),
      service,
      origin,
    })),
  );
  const secrets = [...new Set([...forbidden, ...observations.flatMap((entry) => entry.secrets)])];
  const requests = new Map<
    string,
    { request: ObservedRequest; service: Service; origin: string }
  >();
  for (const observation of observations) {
    for (const request of observation.requests)
      requests.set(request.requestId, {
        request,
        service: observation.service,
        origin: observation.origin,
      });
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
      ({ request }) => request.path === "/api/verify-email" && request.status < 400,
    ),
    "E2E_EMAIL_VERIFICATION_OBSERVATION_MISSING",
  );
  for (const { request, service, origin } of requests.values())
    await verifyCorrelation(origin, request, service, secrets, request);
  for (const origin of new Set(participants.map((participant) => participant.origin))) {
    const logs = await explorerQuery(
      origin,
      "SELECT trace_id, level, message FROM logs WHERE ts_ms >= ? LIMIT 10000",
      [startedMs],
    );
    ensure(logs.length > 0 && logs.length < 10000, "E2E_PRIVACY_LOG_WINDOW_INCOMPLETE");
    assertPrivate(logs, secrets);
    const spans = await explorerQuery(
      origin,
      "SELECT trace_id, name, error, json(attributes) AS attributes FROM spans WHERE start_ms >= ? LIMIT 10000",
      [startedMs],
    );
    ensure(spans.length > 0 && spans.length < 10000, "E2E_PRIVACY_TRACE_WINDOW_INCOMPLETE");
    assertPrivate(spans, secrets);
  }
}

export async function verifyBrowserSignals(origin: string, service: Service, startedMs: number) {
  await poll(
    async () => {
      const events = (
        await explorerQuery(
          origin,
          "SELECT message FROM logs WHERE ts_ms >= ? AND instr(message, ?) > 0 LIMIT 10000",
          [startedMs, `service\\":\\"${service}-browser`],
        )
      ).map((row) => structuredEvent(row["message"]));
      return (
        events.some((event) => event?.["event"] === "http.client.request") &&
        events.some(
          (event) =>
            event?.["event"] === "browser.error" &&
            /^[0-9a-f]{8}$/.test(String(event["error.fingerprint"])),
        ) &&
        events.some((event) => /^(?:LCP|FCP|TTFB)$/.test(String(event?.["event"])))
      );
    },
    (complete) => complete,
    "E2E_BROWSER_HTTP_EXCEPTION_VITALS_MISSING",
    60_000,
  );
}

function foreignHostStatus(origin: string, pathname: string): Promise<number> {
  const url = new URL(pathname, origin);
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      { method: "GET", headers: { host: "attacker.example" }, timeout: 10_000 },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );
    request.once("error", reject);
    request.once("timeout", () => request.destroy(new Error("E2E_LOCAL_EXPLORER_TIMEOUT")));
    request.end();
  });
}

export async function verifyExplorerBoundary(origin: string) {
  for (const pathname of [
    "/cdn-cgi/local/explorer/api/d1/database",
    "/cdn-cgi/local/explorer/api/local/observability/query",
  ]) {
    const response = await fetch(`${origin}${pathname}`, {
      headers: { origin: "https://attacker.example" },
      signal: AbortSignal.timeout(10_000),
      redirect: "manual",
    });
    await response.body?.cancel();
    ensure(response.status === 403, "E2E_LOCAL_EXPLORER_ACCEPTS_FOREIGN_ORIGIN");
    ensure(
      (await foreignHostStatus(origin, pathname)) === 403,
      "E2E_LOCAL_EXPLORER_ACCEPTS_FOREIGN_HOST",
    );
  }
  ensure(
    object((await explorerQuery(origin, "SELECT 1 AS ok", []))[0])["ok"] === 1,
    "E2E_LOCAL_EXPLORER_UNAVAILABLE",
  );
}
