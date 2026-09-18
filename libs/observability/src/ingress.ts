import { Effect, Ref, Result } from "effect";

import { errorFingerprint } from "./errors.ts";
import { parseBrowserEvents, type BrowserEvent } from "./events.ts";
import { httpStatus } from "./http-status.ts";
import { RequestEntropy } from "./request-span.ts";
import { readJson, rejectionStatus, type JsonRequest } from "./request.ts";
import { Telemetry } from "./telemetry.ts";

import type { Application } from "@template/config";

const maximumBodyBytes = 32_768;
const retryAfterSeconds = "60";
const rateWindowMilliseconds = 60_000;
const maximumEventsPerWindow = 1200;
const noStore = { "cache-control": "no-store" };

const ingressWindows = Ref.makeUnsafe<
  ReadonlyMap<Application, { readonly start: number; readonly admitted: number }>
>(new Map());

const admit = (batch: {
  readonly serviceName: Application;
  readonly eventCount: number;
}): Effect.Effect<boolean> =>
  Ref.modify(ingressWindows, (windows) => {
    const arrivedAt = Date.now();
    const stored = windows.get(batch.serviceName);
    const activeWindow =
      stored === undefined || arrivedAt - stored.start > rateWindowMilliseconds
        ? { admitted: 0, start: arrivedAt }
        : stored;
    const admitted = activeWindow.admitted + batch.eventCount <= maximumEventsPerWindow;
    const nextWindow = admitted
      ? { ...activeWindow, admitted: activeWindow.admitted + batch.eventCount }
      : activeWindow;
    return [admitted, new Map([...windows, [batch.serviceName, nextWindow]])];
  });

const kindFields = (
  browserEvent: BrowserEvent,
): Readonly<Record<string, string | number | boolean>> => {
  if (browserEvent.kind === "http") {
    return {
      "http.request.method": browserEvent.method,
      "http.response.status_code": browserEvent.status,
    };
  }
  if (browserEvent.kind === "exception") {
    return {
      "error.fingerprint": errorFingerprint({
        errorType: browserEvent.errorType,
        locations: browserEvent.locations,
      }),
      "error.locations": browserEvent.locations,
      "error.type": browserEvent.errorType,
    };
  }
  return {};
};

const recordBrowserEvent = (recorded: {
  readonly serviceName: Application;
  readonly browserEvent: BrowserEvent;
}): Effect.Effect<void> => {
  const { browserEvent, serviceName } = recorded;
  const failed =
    browserEvent.kind === "exception" ||
    (browserEvent.kind === "http" &&
      (browserEvent.status === 0 || browserEvent.status >= httpStatus.badRequest));
  const attributes = {
    duration_ms: browserEvent.duration,
    "http.route": browserEvent.route,
    measurement_value: browserEvent.value,
    request_id: browserEvent.requestId,
    service: `${serviceName}-browser`,
    span_id: browserEvent.spanId,
    start: new Date(browserEvent.start).toISOString(),
    "telemetry.source": "untrusted-browser",
    trace_id: browserEvent.traceId,
    ...kindFields(browserEvent),
  };
  return failed
    ? Effect.logError(browserEvent.name, attributes)
    : Effect.logInfo(browserEvent.name, attributes);
};

const emptyResponse = (emptyAnswer: {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
}): Response => {
  return new Response(undefined, {
    headers: emptyAnswer.headers ?? noStore,
    status: emptyAnswer.status,
  });
};

type IngressRequest = Readonly<Pick<Request, "method" | "url">> & JsonRequest;

const readEvents = Effect.fn("readEvents")(function* readEvents(incoming: IngressRequest) {
  const telemetry = yield* Telemetry;
  const entropy = yield* RequestEntropy;
  const jsonBody = yield* Effect.result(
    readJson({
      expectedOrigin: new URL(incoming.url).origin,
      incoming,
      limit: maximumBodyBytes,
    }),
  );
  if (Result.isFailure(jsonBody)) {
    return emptyResponse({ status: rejectionStatus[jsonBody.failure.reason] });
  }
  const browserEvents = yield* Effect.result(
    parseBrowserEvents({
      body: jsonBody.success,
      receivedAt: entropy.epochMilliseconds(),
      routeLabels: telemetry.labels,
    }),
  );
  if (Result.isFailure(browserEvents)) {
    return emptyResponse({ status: httpStatus.badRequest });
  }
  return browserEvents.success;
});

export const ingestBrowser = Effect.fn("ingestBrowser")(function* ingestBrowser(
  incoming: IngressRequest,
) {
  if (incoming.method !== "POST") {
    return emptyResponse({
      headers: { ...noStore, allow: "POST" },
      status: httpStatus.methodNotAllowed,
    });
  }
  const { serviceName } = yield* Telemetry;
  const browserEvents = yield* readEvents(incoming);
  if (browserEvents instanceof Response) {
    return browserEvents;
  }
  if (!(yield* admit({ eventCount: browserEvents.length, serviceName }))) {
    return emptyResponse({
      headers: { ...noStore, "retry-after": retryAfterSeconds },
      status: httpStatus.tooManyRequests,
    });
  }
  yield* Effect.forEach(
    browserEvents,
    (browserEvent) => recordBrowserEvent({ browserEvent, serviceName }),
    { discard: true },
  );
  return emptyResponse({ status: httpStatus.accepted });
});
