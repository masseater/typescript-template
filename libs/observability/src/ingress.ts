import { Effect, Result } from "effect";

import { errorFingerprint } from "./errors.ts";
import { parseBrowserEvents, type BrowserEvent } from "./events.ts";
import { httpStatus } from "./http-status.ts";
import { readJson, rejectionStatus, type JsonRequest } from "./request.ts";
import { Telemetry } from "./telemetry.ts";

import type { Application } from "@template/config";

type IngressRequest = Readonly<Pick<Request, "method" | "url">> & JsonRequest;
type LogFields = Readonly<Record<string, string | number | boolean>>;
type IngressWindow = {
  start: number;
  count: number;
};

const maximumBodyBytes = 32_768;
const retryAfterSeconds = "60";
const ingressWindows = new Map<Application, IngressWindow>();
const noStore = { "cache-control": "no-store" };

const emptyResponse = (
  status: number,
  headers: Readonly<Record<string, string>> = noStore,
): Response => {
  return new Response(undefined, { headers, status });
};

const rateWindowMilliseconds = 60_000;

const maximumEventsPerWindow = 1200;

const admit = (serviceName: Application, count: number): boolean => {
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
};

const kindFields = (event: BrowserEvent): LogFields => {
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
};

const recordBrowserEvent = (serviceName: Application, event: BrowserEvent): Effect.Effect<void> => {
  const failed =
    event.kind === "exception" ||
    (event.kind === "http" && (event.status === 0 || event.status >= httpStatus.badRequest));
  const attributes = {
    duration_ms: event.duration,
    "http.route": event.route,
    measurement_value: event.value,
    request_id: event.requestId,
    service: `${serviceName}-browser`,
    span_id: event.spanId,
    start: new Date(event.start).toISOString(),
    "telemetry.source": "untrusted-browser",
    trace_id: event.traceId,
    ...kindFields(event),
  };
  return failed ? Effect.logError(event.name, attributes) : Effect.logInfo(event.name, attributes);
};

const readEvents = Effect.fn("readEvents")(function* readEvents(request: IngressRequest) {
  const telemetry = yield* Telemetry;
  const input = yield* Effect.result(
    readJson(request, new URL(request.url).origin, maximumBodyBytes),
  );
  if (Result.isFailure(input)) {
    return emptyResponse(rejectionStatus[input.failure.reason]);
  }
  const events = yield* Effect.result(
    parseBrowserEvents(input.success, telemetry.labels, Date.now()),
  );
  if (Result.isFailure(events)) {
    return emptyResponse(httpStatus.badRequest);
  }
  return events.success;
});

const ingestBrowser = Effect.fn("ingestBrowser")(function* ingestBrowser(request: IngressRequest) {
  if (request.method !== "POST") {
    return emptyResponse(httpStatus.methodNotAllowed, { ...noStore, allow: "POST" });
  }
  const { serviceName } = yield* Telemetry;
  const events = yield* readEvents(request);
  if (events instanceof Response) {
    return events;
  }
  if (!admit(serviceName, events.length)) {
    return emptyResponse(httpStatus.tooManyRequests, {
      ...noStore,
      "retry-after": retryAfterSeconds,
    });
  }
  yield* Effect.forEach(events, (event) => recordBrowserEvent(serviceName, event), {
    discard: true,
  });
  return emptyResponse(httpStatus.accepted);
});

export { ingestBrowser };
