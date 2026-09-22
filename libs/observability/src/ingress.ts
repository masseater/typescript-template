import { DateTime, Effect, HashSet, Ref, Result } from "effect";

import { errorFingerprint } from "./errors.ts";
import { parseBrowserEvents, type BrowserEvent } from "./events.ts";
import { httpStatus } from "@repo/config";
import { RequestEntropy } from "./request-span.ts";
import { readJson, rejectionStatus, type JsonRequest } from "./request.ts";
import { logAt, statusSeverity, type Severity } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";

import type { ServiceName } from "./service-name.ts";

const maximumBodyBytes = 32_768;
const retryAfterSeconds = "60";
const rateWindowMilliseconds = 60_000;
const maximumEventsPerWindow = 1200;
const noStore = { "cache-control": "no-store" };

const ingressWindows = Ref.makeUnsafe<
  ReadonlyMap<
    ServiceName,
    {
      readonly start: number;
      readonly admitted: number;
      readonly recorded: HashSet.HashSet<string>;
    }
  >
>(new Map());

const unrecorded = (
  recorded: HashSet.HashSet<string>,
  browserEvents: readonly BrowserEvent[],
): readonly BrowserEvent[] => {
  const firstAt = new Map(
    browserEvents
      .map((browserEvent, position) => [browserEvent.spanId, position] as const)
      .toReversed(),
  );
  return browserEvents.filter(
    (browserEvent, position) =>
      !HashSet.has(recorded, browserEvent.spanId) && firstAt.get(browserEvent.spanId) === position,
  );
};

const admitUnrecorded = (batch: {
  readonly serviceName: ServiceName;
  readonly browserEvents: readonly BrowserEvent[];
}): Effect.Effect<readonly BrowserEvent[] | undefined> =>
  Ref.modify(ingressWindows, (windows) => {
    const arrivedAt = DateTime.toEpochMillis(DateTime.nowUnsafe());
    const stored = windows.get(batch.serviceName);
    const activeWindow =
      stored === undefined || arrivedAt - stored.start > rateWindowMilliseconds
        ? { admitted: 0, recorded: HashSet.empty<string>(), start: arrivedAt }
        : stored;
    const fresh = unrecorded(activeWindow.recorded, batch.browserEvents);
    const overflowed = activeWindow.admitted + fresh.length > maximumEventsPerWindow;
    const nextWindow = overflowed
      ? activeWindow
      : {
          ...activeWindow,
          admitted: activeWindow.admitted + fresh.length,
          recorded: fresh.reduce(
            (recorded, browserEvent) => HashSet.add(recorded, browserEvent.spanId),
            activeWindow.recorded,
          ),
        };
    const admitted: readonly BrowserEvent[] | undefined = overflowed ? undefined : fresh;
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
      "error.fingerprint": errorFingerprint(browserEvent.errorType, browserEvent.locations),
      "error.locations": browserEvent.locations,
      "error.type": browserEvent.errorType,
    };
  }
  return {};
};

const eventSeverity = (browserEvent: BrowserEvent): Severity => {
  if (browserEvent.kind === "exception") {
    return "Error";
  }
  return browserEvent.kind === "http" ? statusSeverity(browserEvent.status) : "Info";
};

const recordBrowserEvent = (recorded: {
  readonly serviceName: ServiceName;
  readonly browserEvent: BrowserEvent;
}): Effect.Effect<void> => {
  const { browserEvent, serviceName } = recorded;
  const attributes = {
    duration_ms: browserEvent.duration,
    "http.route": browserEvent.route,
    measurement_value: browserEvent.value,
    request_id: browserEvent.requestId,
    service: `${serviceName}-browser`,
    span_id: browserEvent.spanId,
    start: DateTime.formatIso(DateTime.makeUnsafe(browserEvent.start)),
    "telemetry.source": "untrusted-browser",
    trace_id: browserEvent.traceId,
    ...kindFields(browserEvent),
  };
  return logAt(eventSeverity(browserEvent), { attributes, eventName: browserEvent.name });
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

const recordAdmitted = (batch: {
  readonly serviceName: ServiceName;
  readonly browserEvents: readonly BrowserEvent[];
}): Effect.Effect<Response> =>
  Effect.gen(function* recordAdmittedProgram() {
    const admitted = yield* admitUnrecorded(batch);
    if (admitted === undefined) {
      return emptyResponse({
        headers: { ...noStore, "retry-after": retryAfterSeconds },
        status: httpStatus.tooManyRequests,
      });
    }
    yield* Effect.forEach(
      admitted,
      (browserEvent) => recordBrowserEvent({ browserEvent, serviceName: batch.serviceName }),
      { discard: true },
    );
    return emptyResponse({ status: httpStatus.accepted });
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
  return yield* recordAdmitted({ browserEvents, serviceName });
});
