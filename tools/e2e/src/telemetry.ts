import type { ObservedRequest, Service } from "./observation.ts";
import { assertPrivate, relatedSpans, traceSpans } from "./observation.ts";
import { ensure, grafana, json, object, poll, string } from "./support.ts";
import { httpStatus, requestTimeout } from "./http.ts";
import type { BrowserSession } from "./browser.ts";

const millisecondsPerSecond = 1000;
const correlationLookbackSeconds = 300;
const telemetryTimeout = 60_000;
const privacyLogLimit = 5000;
const lokiRange = "loki/loki/api/v1/query_range";
const prometheusQuery = "prometheus/api/v1/query";
const prometheusExemplars = "prometheus/api/v1/query_exemplars";

interface CorrelationExpectation {
  readonly forbidden: readonly string[];
  readonly observed?: ObservedRequest;
  readonly service: Service;
}

interface CorrelationContext extends CorrelationExpectation {
  readonly end: string;
  readonly requestId: string;
  readonly start: string;
  readonly traceId: string;
}

interface Participant {
  readonly browser: BrowserSession;
  readonly service: Service;
}

function currentSecond(): number {
  return Math.floor(Date.now() / millisecondsPerSecond);
}

function nextSecond(): string {
  return String(Math.ceil(Date.now() / millisecondsPerSecond));
}

async function query(
  route: string,
  parameters: Readonly<Record<string, string>>,
): Promise<unknown> {
  return json(
    `${grafana}/api/datasources/proxy/uid/${route}?${new URLSearchParams(parameters).toString()}`,
  );
}

async function privateQuery(
  context: CorrelationContext,
  route: string,
  parameters: Readonly<Record<string, string>>,
): Promise<string> {
  const result = await query(route, parameters);
  assertPrivate(result, context.forbidden);
  return JSON.stringify(result);
}

async function serverLogsCorrelated(context: CorrelationContext): Promise<boolean> {
  const logs = await privateQuery(context, lokiRange, {
    end: context.end,
    limit: "100",
    query: `{service_name="${context.service}-server"} | request_id="${context.requestId}"`,
    start: context.start,
  });
  return logs.includes(context.traceId);
}

async function traceCorrelated(context: CorrelationContext): Promise<boolean> {
  const traceResponse = await fetch(
    `${grafana}/api/datasources/proxy/uid/tempo/api/traces/${context.traceId}`,
    { signal: AbortSignal.timeout(requestTimeout.service) },
  );
  if (traceResponse.status === httpStatus.notFound) {
    return false;
  }
  ensure(traceResponse.ok, "E2E_TRACE_QUERY_FAILED");
  const traces: unknown = await traceResponse.json();
  assertPrivate(traces, context.forbidden);
  if (!JSON.stringify(traces).includes(`${context.service}-server`)) {
    return false;
  }
  return (
    context.observed === undefined ||
    relatedSpans(traceSpans(traces), context.observed, context.service)
  );
}

async function metricsCorrelated(context: CorrelationContext): Promise<boolean> {
  const metrics = object(
    await query(prometheusQuery, {
      query: `http_server_request_duration_seconds_count{service_name="${context.service}-server"}`,
    }),
  );
  const data = object(metrics["data"]);
  assertPrivate(metrics, context.forbidden);
  if (!Array.isArray(data["result"]) || data["result"].length === 0) {
    return false;
  }
  const exemplars = await privateQuery(context, prometheusExemplars, {
    end: context.end,
    query: `http_server_request_duration_seconds_bucket{service_name="${context.service}-server"}`,
    start: context.start,
  });
  return exemplars.includes(context.traceId);
}

async function browserCorrelated(context: CorrelationContext): Promise<boolean> {
  const clientTraceparent = context.observed?.clientTraceparent;
  if (clientTraceparent === undefined || clientTraceparent.length === 0) {
    return true;
  }
  const browserLogs = await privateQuery(context, lokiRange, {
    end: context.end,
    limit: "100",
    query: `{service_name="${context.service}-browser"} | request_id="${context.requestId}"`,
    start: context.start,
  });
  const browserExemplars = await privateQuery(context, prometheusExemplars, {
    end: context.end,
    query: `http_client_request_duration_seconds_bucket{service_name="${context.service}-browser"}`,
    start: context.start,
  });
  return browserLogs.includes(context.traceId) && browserExemplars.includes(context.traceId);
}

async function correlationComplete(context: CorrelationContext): Promise<boolean> {
  return (
    (await serverLogsCorrelated(context)) &&
    (await traceCorrelated(context)) &&
    (await metricsCorrelated(context)) &&
    (await browserCorrelated(context))
  );
}

async function verifyCorrelation(
  response: Readonly<{ requestId: unknown; traceparent: unknown }>,
  expectation: CorrelationExpectation,
): Promise<void> {
  const requestId = string(response.requestId);
  const traceparent = string(response.traceparent);
  ensure(/^[0-9a-f-]{36}$/u.test(requestId), "E2E_REQUEST_ID_MISSING");
  ensure(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u.test(traceparent), "E2E_TRACE_CONTEXT_MISSING");
  const [, traceId] = traceparent.split("-");
  ensure(traceId !== undefined, "E2E_TRACE_ID_MISSING");
  const start = String(currentSecond() - correlationLookbackSeconds);
  await poll({
    accept: (complete) => complete,
    code: "E2E_REAL_LOG_TRACE_METRIC_CORRELATION_MISSING",
    read: async () =>
      correlationComplete({ ...expectation, end: nextSecond(), requestId, start, traceId }),
    timeout: telemetryTimeout,
  });
}

function logEntryCount(logs: Readonly<Record<string, unknown>>): number {
  const streams = object(logs["data"])["result"];
  ensure(Array.isArray(streams), "E2E_LOG_RESULT_INVALID");
  let entries = 0;
  for (const stream of streams) {
    const { values } = object(stream);
    ensure(Array.isArray(values), "E2E_LOG_VALUES_INVALID");
    entries += values.length;
  }
  return entries;
}

async function verifyServicePrivacy(
  service: Service,
  secrets: readonly string[],
  started: number,
): Promise<void> {
  const logs = object(
    await query(lokiRange, {
      end: nextSecond(),
      limit: String(privacyLogLimit),
      query: `{service_name=~"${service}-(server|browser)"}`,
      start: String(started),
    }),
  );
  assertPrivate(logs, secrets);
  const entries = logEntryCount(logs);
  ensure(entries > 0 && entries < privacyLogLimit, "E2E_PRIVACY_LOG_WINDOW_INCOMPLETE");
  const metrics = await query(prometheusQuery, {
    query: `{service_name=~"${service}-(server|browser)"}`,
  });
  assertPrivate(metrics, secrets);
}

function observedRequest(
  requests: readonly Readonly<{ request: ObservedRequest }>[],
  path: string,
): boolean {
  return requests.some(
    ({ request }) => request.path === path && request.status < httpStatus.badRequest,
  );
}

async function verifyJourneyTelemetry(
  participants: readonly Participant[],
  forbidden: readonly string[],
  started: number,
): Promise<void> {
  const observations = await Promise.all(
    participants.map(async ({ browser, service }) => ({
      ...(await browser.finishObservation()),
      service,
    })),
  );
  const secrets = [...new Set([...forbidden, ...observations.flatMap((entry) => entry.secrets)])];
  const requests = [
    ...new Map(
      observations.flatMap(({ requests: observed, service }) =>
        observed.map((request) => [request.requestId, { request, service }] as const),
      ),
    ).values(),
  ];
  ensure(requests.length > 0, "E2E_OPERATION_OBSERVATIONS_MISSING");
  ensure(observedRequest(requests, "/api/auth/sign-up/email"), "E2E_SIGNUP_OBSERVATION_MISSING");
  ensure(
    observedRequest(requests, "/api/auth/verify-email"),
    "E2E_EMAIL_VERIFICATION_OBSERVATION_MISSING",
  );
  for (const { request, service } of requests) {
    await verifyCorrelation(request, { forbidden: secrets, observed: request, service });
  }
  await Promise.all(
    [...new Set(participants.map((participant) => participant.service))].map(async (service) => {
      await verifyServicePrivacy(service, secrets, started);
    }),
  );
}

async function verifyBrowserSignals(service: Service, start: number): Promise<void> {
  await poll({
    accept: (complete) => complete,
    code: "E2E_BROWSER_HTTP_EXCEPTION_VITALS_MISSING",
    read: async () => {
      const logs = await query(lokiRange, {
        end: nextSecond(),
        limit: "1000",
        query: `{service_name="${service}-browser"}`,
        start: String(start),
      });
      const text = JSON.stringify(logs);
      return (
        text.includes("http.client.request") &&
        text.includes("browser.error") &&
        /LCP|FCP|TTFB/u.test(text)
      );
    },
    timeout: telemetryTimeout,
  });
}

export { currentSecond, verifyBrowserSignals, verifyCorrelation, verifyJourneyTelemetry };
