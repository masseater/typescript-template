import type { Attributes, ServiceName } from "./protocol.ts";
import type { ExecutionContext, Exporter } from "./exporter.ts";
import { logRecord, millisecondsPerSecond, spanKind, spanRecord } from "./protocol.ts";
import type { BrowserEvent } from "./events.ts";
import { histogram } from "./metrics.ts";
import { httpStatus } from "./http-status.ts";
import { parseBrowserEvents } from "./events.ts";

interface Ingress {
  readonly exporter: Exporter;
  readonly labels: ReadonlySet<string>;
  readonly serviceName: ServiceName;
}
interface IngressWindow {
  start: number;
  count: number;
}
interface Measurement {
  readonly name: string;
  readonly unit: string;
  readonly value: number;
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

function rejectRequest(request: Request): Response | undefined {
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

async function readBoundedText(body: ReadableStream<Uint8Array>): Promise<string | undefined> {
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

function parseEvents(text: string, labels: ReadonlySet<string>): BrowserEvent[] | undefined {
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

function measurement(event: BrowserEvent): Measurement {
  if (event.kind === "http") {
    return {
      name: "http.client.request.duration",
      unit: "s",
      value: event.duration / millisecondsPerSecond,
    };
  }
  if (event.kind === "exception") {
    return { name: "browser.exception", unit: "1", value: 1 };
  }
  return {
    name: `browser.web_vital.${event.name.toLowerCase()}`,
    unit: event.name === "CLS" ? "1" : "ms",
    value: event.value,
  };
}

function eventAttributes(event: BrowserEvent): Attributes {
  return {
    "http.route": event.route,
    "telemetry.source": "untrusted-browser",
    ...(event.kind === "http"
      ? { "http.request.method": event.method, "http.response.status_code": event.status }
      : {}),
  };
}

function recordBrowserEvent(exporter: Exporter, event: BrowserEvent): void {
  const values = eventAttributes(event);
  const failed =
    event.kind === "exception" ||
    (event.kind === "http" && (event.status === 0 || event.status >= httpStatus.badRequest));
  const end = event.start + event.duration;
  const { name } = event;
  const logValues = { ...values, "duration.ms": event.duration, "measurement.value": event.value };
  exporter.enqueue({
    records: [logRecord({ context: event, failed, name, time: end, values: logValues })],
    runtime: "browser",
    signal: "logs",
  });
  const kind = event.kind === "http" ? spanKind.client : spanKind.internal;
  exporter.enqueue({
    records: [spanRecord({ context: event, end, failed, kind, name, start: event.start, values })],
    runtime: "browser",
    signal: "traces",
  });
  exporter.enqueue({
    records: [
      histogram({ ...measurement(event), context: event, end, start: event.start, values }),
    ],
    runtime: "browser",
    signal: "metrics",
  });
}

async function readEvents(ingress: Ingress, request: Request): Promise<BrowserEvent[] | Response> {
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
  request: Request,
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

async function ingestBrowser(
  ingress: Ingress,
  request: Request,
  executionContext?: ExecutionContext,
): Promise<Response> {
  const events = await acceptEvents(ingress, request);
  if (events instanceof Response) {
    return events;
  }
  for (const event of events) {
    recordBrowserEvent(ingress.exporter, event);
  }
  ingress.exporter.flushInBackground(executionContext);
  return emptyResponse(httpStatus.accepted);
}

export { ingestBrowser };
