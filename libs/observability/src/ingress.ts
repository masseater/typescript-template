import { clientErrorSchema, readJson } from "./request.ts";
import type { Application } from "@template/config";
import type { BrowserEvent } from "./events.ts";
import type { JsonRequest } from "./request.ts";
import type { LogSink } from "./log.ts";
import { errorFingerprint } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { is } from "valibot";
import { parseBrowserEvents } from "./events.ts";
import { writeLog } from "./log.ts";

interface Ingress {
  readonly log: LogSink;
  readonly labels: Readonly<ReadonlySet<string>>;
  readonly release: string;
  readonly serviceName: Application;
}
type IngressRequest = Readonly<Pick<Request, "method" | "url">> & JsonRequest;
type LogFields = Readonly<Record<string, string | number | boolean>>;
interface IngressWindow {
  start: number;
  count: number;
}

const maximumBodyBytes = 32_768;
const rateWindowMilliseconds = 60_000;
const maximumEventsPerWindow = 1200;
const retryAfterSeconds = "60";
const ingressWindows = new Map<Application, IngressWindow>();
const noStore = { "cache-control": "no-store" };

function emptyResponse(
  status: number,
  headers: Readonly<Record<string, string>> = noStore,
): Response {
  return new Response(undefined, { headers, status });
}

function admit(serviceName: Application, count: number): boolean {
  const now = Date.now();
  const window = ingressWindows.get(serviceName) ?? { count: 0, start: now };
  if (now - window.start > rateWindowMilliseconds) {
    window.start = now;
    window.count = 0;
  }
  ingressWindows.set(serviceName, window);
  if (window.count + count > maximumEventsPerWindow) {
    return false;
  }
  window.count += count;
  return true;
}

function kindFields(event: BrowserEvent): LogFields {
  if (event.kind === "http") {
    return {
      "http.request.method": event.method,
      "http.response.status_code": event.status,
    };
  }
  if (event.kind === "exception") {
    return {
      "error.fingerprint": errorFingerprint(event.errorType, event.locations),
      "error.locations": event.locations,
      "error.type": event.errorType,
    };
  }
  return {};
}

function recordBrowserEvent(ingress: Ingress, event: BrowserEvent): void {
  const failed =
    event.kind === "exception" ||
    (event.kind === "http" && (event.status === 0 || event.status >= httpStatus.badRequest));
  writeLog(ingress.log, failed ? "error" : "info", {
    duration_ms: event.duration,
    event: event.name,
    "http.route": event.route,
    measurement_value: event.value,
    release: ingress.release,
    request_id: event.requestId,
    service: `${ingress.serviceName}-browser`,
    span_id: event.spanId,
    start: new Date(event.start).toISOString(),
    "telemetry.source": "untrusted-browser",
    trace_id: event.traceId,
    ...kindFields(event),
  });
}

async function readEvents(
  ingress: Ingress,
  request: IngressRequest,
): Promise<BrowserEvent[] | Response> {
  if (request.method !== "POST") {
    return emptyResponse(httpStatus.methodNotAllowed, { ...noStore, allow: "POST" });
  }
  try {
    const body = await readJson(request, new URL(request.url).origin, maximumBodyBytes);
    return parseBrowserEvents(body, ingress.labels, Date.now());
  } catch (error) {
    return emptyResponse(is(clientErrorSchema, error) ? error.statusCode : httpStatus.badRequest);
  }
}

async function acceptEvents(
  ingress: Ingress,
  request: IngressRequest,
): Promise<BrowserEvent[] | Response> {
  const events = await readEvents(ingress, request);
  if (events instanceof Response || admit(ingress.serviceName, events.length)) {
    return events;
  }
  return emptyResponse(httpStatus.tooManyRequests, {
    ...noStore,
    "retry-after": retryAfterSeconds,
  });
}

async function ingestBrowser(ingress: Ingress, request: IngressRequest): Promise<Response> {
  const events = await acceptEvents(ingress, request);
  if (events instanceof Response) {
    return events;
  }
  for (const event of events) {
    recordBrowserEvent(ingress, event);
  }
  return emptyResponse(httpStatus.accepted);
}

export { ingestBrowser };
export type { IngressRequest };
