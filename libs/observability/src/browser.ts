import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

import { makeEventQueue, type EventQueue } from "./browser-queue.ts";
import { errorAttributes, wireErrorType } from "./errors.ts";
import { maximumMeasurement, type BrowserEvent } from "./events.ts";
import {
  httpMethod,
  isRequestId,
  isRoutes,
  randomHex,
  routeLabel,
  routeMessage,
  spanIdBytes,
  traceIdBytes,
  traceparentOf,
  type Correlation,
} from "./protocol.ts";
import { stoppableVitals, type VitalMetric } from "./vital-reporting.ts";
const flushIntervalMilliseconds = 3000;
const exportTimeoutMilliseconds = 5000;
const elapsedSince = (startedAt: number): number =>
  Math.min(performance.now() - startedAt, maximumMeasurement);
type FetchInstrumentation = {
  readonly endpoint: string;
  readonly queue: EventQueue;
  readonly routes: Readonly<Record<string, string>>;
  readonly send: typeof fetch;
};
const outgoingSpan = (
  outgoing: Request,
): {
  readonly span: {
    readonly spanId: string;
    readonly start: number;
    readonly traceId: string;
  };
  readonly traced: Request;
} => {
  const span = {
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    traceId: randomHex(traceIdBytes),
  };
  const traced = new Request(outgoing, {
    headers: new Headers([...outgoing.headers.entries(), ["traceparent", traceparentOf(span)]]),
  });
  return { span, traced };
};
const tracedFetch = async (
  instrumentation: FetchInstrumentation,
  outgoing: Request,
): Promise<Response> => {
  const startedAt = performance.now();
  const { span, traced } = outgoingSpan(outgoing);
  const fallbackRequestId = crypto.randomUUID();
  const recordAnswer = (answered: {
    readonly requestId: string;
    readonly status: number;
  }): void => {
    instrumentation.queue.enqueue({
      ...span,
      ...answered,
      duration: elapsedSince(startedAt),
      kind: "http",
      method: httpMethod(outgoing.method),
      name: "http.client.request",
      route: routeLabel(new URL(outgoing.url).pathname, instrumentation.routes),
      value: 0,
    });
  };
  try {
    const received = await instrumentation.send(traced);
    recordAnswer({
      requestId: [received.headers.get("x-request-id")].find(isRequestId) ?? fallbackRequestId,
      status: received.status,
    });
    return received;
  } catch (unsent) {
    recordAnswer({ requestId: fallbackRequestId, status: 0 });
    throw unsent;
  }
};
const patchFetch = (instrumentation: FetchInstrumentation): (() => void) => {
  const originalFetch = globalThis.fetch;
  const instrumentedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      globalThis.location.href,
    );
    if (url.origin !== globalThis.location.origin || url.pathname === instrumentation.endpoint) {
      return instrumentation.send(input, init);
    }
    return tracedFetch(instrumentation, new Request(input instanceof Request ? input : url, init));
  };
  globalThis.fetch = instrumentedFetch;
  return () => {
    if (globalThis.fetch === instrumentedFetch) {
      globalThis.fetch = originalFetch;
    }
  };
};
type Recorder = {
  readonly documentContext: Correlation;
  readonly queue: EventQueue;
  readonly routes: Readonly<Record<string, string>>;
};
const documentFields = (
  recorder: Recorder,
): Omit<
  Extract<
    BrowserEvent,
    {
      kind: "vital";
    }
  >,
  "kind" | "name" | "value"
> => {
  return {
    ...recorder.documentContext,
    duration: 0,
    method: httpMethod("GET"),
    route: routeLabel(globalThis.location.pathname, recorder.routes),
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    status: 0,
  };
};
const recordException = (
  recorder: Recorder,
  exception: {
    readonly name: "browser.error" | "browser.unhandledrejection";
    readonly thrown: unknown;
  },
): void => {
  const attributes = errorAttributes(exception.thrown);
  recorder.queue.enqueue({
    ...documentFields(recorder),
    errorType: wireErrorType(attributes["error.type"]),
    kind: "exception",
    locations: attributes["error.locations"],
    name: exception.name,
    value: 1,
  });
  recorder.queue.flushInBackground();
};
const listen = (recorder: Recorder): (() => void) => {
  const { queue } = recorder;
  const rejectionListener = (rejection: Readonly<Pick<PromiseRejectionEvent, "reason">>): void => {
    recordException(recorder, { name: "browser.unhandledrejection", thrown: rejection.reason });
  };
  const visibilityListener = (): void => {
    if (document.visibilityState === "hidden") {
      queue.flushBeforeUnload();
    }
  };
  const pageHideListener = (): void => {
    queue.flushBeforeUnload();
  };
  const errorListener = (uncaught: Readonly<Pick<ErrorEvent, "error">>): void => {
    recordException(recorder, { name: "browser.error", thrown: uncaught.error });
  };
  globalThis.addEventListener("error", errorListener);
  globalThis.addEventListener("unhandledrejection", rejectionListener);
  globalThis.addEventListener("pagehide", pageHideListener);
  document.addEventListener("visibilitychange", visibilityListener);
  return () => {
    globalThis.removeEventListener("error", errorListener);
    globalThis.removeEventListener("unhandledrejection", rejectionListener);
    globalThis.removeEventListener("pagehide", pageHideListener);
    document.removeEventListener("visibilitychange", visibilityListener);
  };
};
const observeVitals = (recorder: Recorder): (() => void) => {
  const vitals = stoppableVitals((metric: VitalMetric): void => {
    recorder.queue.enqueue({
      ...documentFields(recorder),
      kind: "vital",
      name: metric.name,
      value: Math.min(Math.max(metric.value, 0), maximumMeasurement),
    });
    recorder.queue.flushInBackground();
  });
  onCLS(vitals.report, { reportAllChanges: true });
  onFCP(vitals.report);
  onINP(vitals.report, { reportAllChanges: true });
  onLCP(vitals.report, { reportAllChanges: true });
  onTTFB(vitals.report);
  return vitals.stop;
};
const batchSender =
  (exporter: { readonly endpoint: string; readonly send: typeof fetch }) =>
  async (batch: readonly BrowserEvent[]): Promise<void> => {
    const delivery = await exporter.send(exporter.endpoint, {
      body: JSON.stringify(batch),
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      keepalive: true,
      method: "POST",
      mode: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(exportTimeoutMilliseconds),
    });
    if (!delivery.ok) {
      throw new Error(`Browser telemetry rejected (${String(delivery.status)})`);
    }
  };
export const initBrowserTelemetry = ({
  endpoint,
  routes,
}: {
  readonly endpoint: "/api/telemetry";
  readonly routes: Readonly<Record<string, string>>;
}): {
  readonly dispose: () => void;
} => {
  if (!isRoutes(routes)) {
    throw new Error(routeMessage);
  }
  const send = globalThis.fetch.bind(globalThis);
  const queue = makeEventQueue(batchSender({ endpoint, send }));
  const recorder: Recorder = {
    documentContext: {
      requestId: crypto.randomUUID(),
      spanId: randomHex(spanIdBytes),
      traceId: randomHex(traceIdBytes),
    },
    queue,
    routes,
  };
  const restoreFetch = patchFetch({ endpoint, queue, routes, send });
  const stopListening = listen(recorder);
  const stopObservingVitals = observeVitals(recorder);
  const flushTimer = globalThis.setInterval(() => {
    queue.flushInBackground();
  }, flushIntervalMilliseconds);
  return {
    dispose: () => {
      queue.close();
      globalThis.clearInterval(flushTimer);
      restoreFetch();
      stopListening();
      stopObservingVitals();
      queue.flushInBackground();
    },
  };
};
