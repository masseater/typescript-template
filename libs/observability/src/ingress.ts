import { logError, logInfo } from "./log.ts";
import type { BrowserEvent } from "./events.ts";
import type { ServiceName } from "./protocol.ts";
import { errorFingerprint } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { parseBrowserEvents } from "./events.ts";

interface Ingress {
  readonly labels: Readonly<ReadonlySet<string>>;
  readonly release: string;
  readonly serviceName: ServiceName;
}
type IngressRequest = Readonly<Pick<Request, "method" | "url">> & {
  readonly body: Readonly<AsyncIterable<Uint8Array>> | null;
  readonly headers: Readonly<Pick<Headers, "get">>;
};
type LogFields = Readonly<Record<string, string | number | boolean>>;
interface IngressWindow {
  start: number;
  count: number;
}

const maximumBodyBytes = 32_768;
const rateWindowMilliseconds = 60_000;
const maximumEventsPerWindow = 1200;
const retryAfterSeconds = "60";
const ingressWindows = new Map<ServiceName, IngressWindow>();
const noStore = { "cache-control": "no-store" };

function emptyResponse(
  status: number,
  headers: Readonly<Record<string, string>> = noStore,
): Response {
  return new Response(undefined, { headers, status });
}

function rejectRequest(request: IngressRequest): Response | undefined {
  if (request.method !== "POST") {
    return emptyResponse(httpStatus.methodNotAllowed, { ...noStore, allow: "POST" });
  }
  if (
    request.headers.get("origin") !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return emptyResponse(httpStatus.forbidden);
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return emptyResponse(httpStatus.unsupportedMediaType);
  }
  if (Number(request.headers.get("content-length")) > maximumBodyBytes) {
    return emptyResponse(httpStatus.payloadTooLarge);
  }
  return undefined;
}

async function readBoundedText(
  body: Readonly<AsyncIterable<Uint8Array>>,
): Promise<string | undefined> {
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for await (const chunk of body) {
    size += chunk.byteLength;
    if (size > maximumBodyBytes) {
      return undefined;
    }
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

function parseEvents(
  text: string,
  labels: Readonly<ReadonlySet<string>>,
): BrowserEvent[] | undefined {
  try {
    return parseBrowserEvents(JSON.parse(text) as unknown, labels, Date.now());
  } catch {
    return undefined;
  }
}

function admit(serviceName: ServiceName, count: number): boolean {
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
  const log = failed ? logError : logInfo;
  log({
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
  const rejected = rejectRequest(request);
  if (rejected) {
    return rejected;
  }
  if (!request.body) {
    return emptyResponse(httpStatus.badRequest);
  }
  const text = await readBoundedText(request.body);
  if (text === undefined) {
    return emptyResponse(httpStatus.payloadTooLarge);
  }
  return parseEvents(text, ingress.labels) ?? emptyResponse(httpStatus.badRequest);
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
