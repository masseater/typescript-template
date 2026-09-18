import { Effect, Result } from "effect";
import { readJson, rejectionStatus } from "./request.ts";
import type { Application } from "@repo/config";
import type { BrowserEvent } from "./events.ts";
import type { JsonRequest } from "./request.ts";
import { Telemetry } from "./telemetry.ts";
import { errorFingerprint } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { parseBrowserEvents } from "./events.ts";

type IngressRequest = Readonly<Pick<Request, "method" | "url">> & JsonRequest;
type LogFields = Readonly<Record<string, string | number | boolean>>;
interface IngressWindow {
  start: number;
  count: number;
  readonly recorded: Set<string>;
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

function currentWindow(serviceName: Application): IngressWindow {
  const now = Date.now();
  const window = ingressWindows.get(serviceName) ?? { count: 0, recorded: new Set(), start: now };
  if (now - window.start > rateWindowMilliseconds) {
    window.start = now;
    window.count = 0;
    window.recorded.clear();
  }
  ingressWindows.set(serviceName, window);
  return window;
}

function unrecorded(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  window: IngressWindow,
  events: readonly BrowserEvent[],
): readonly BrowserEvent[] {
  const batch = new Set<string>();
  return events.filter((event) => {
    if (window.recorded.has(event.spanId) || batch.has(event.spanId)) {
      return false;
    }
    batch.add(event.spanId);
    return true;
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function admit(window: IngressWindow, count: number): boolean {
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

function recordBrowserEvent(serviceName: Application, event: BrowserEvent): Effect.Effect<void> {
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
}

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

const recordUnseen = Effect.fn("recordUnseen")(function* recordUnseen(
  serviceName: Application,
  events: readonly BrowserEvent[],
) {
  const window = currentWindow(serviceName);
  const fresh = unrecorded(window, events);
  if (!admit(window, fresh.length)) {
    return emptyResponse(httpStatus.tooManyRequests, {
      ...noStore,
      "retry-after": retryAfterSeconds,
    });
  }
  for (const event of fresh) {
    window.recorded.add(event.spanId);
  }
  yield* Effect.forEach(fresh, (event) => recordBrowserEvent(serviceName, event), {
    discard: true,
  });
  return emptyResponse(httpStatus.accepted);
});

const ingestBrowser = Effect.fn("ingestBrowser")(function* ingestBrowser(request: IngressRequest) {
  if (request.method !== "POST") {
    return emptyResponse(httpStatus.methodNotAllowed, { ...noStore, allow: "POST" });
  }
  const { serviceName } = yield* Telemetry;
  const events = yield* readEvents(request);
  return events instanceof Response ? events : yield* recordUnseen(serviceName, events);
});

export { ingestBrowser };
