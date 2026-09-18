import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

import { BrowserEventQueue } from "./browser-queue.ts";
import { errorAttributes } from "./errors.ts";
import { maximumMeasurement } from "./events.ts";
import {
  httpMethod,
  isRequestId,
  isRoutes,
  randomHex,
  routeLabel,
  routeMessage,
  spanIdBytes,
  traceIdBytes,
} from "./protocol.ts";

import type { Metric } from "web-vitals";
import type { EventQueue } from "./browser-queue.ts";
import type { BrowserEvent } from "./events.ts";
import type { Correlation, HttpMethod } from "./protocol.ts";

type BrowserTelemetryOptions = {
  readonly endpoint: "/api/telemetry";
  readonly routes: Readonly<Record<string, string>>;
};
type BrowserTelemetry = {
  readonly dispose: () => void;
  readonly flush: () => Promise<void>;
};
type Recorder = {
  readonly documentContext: Correlation;
  readonly queue: EventQueue;
  readonly routes: Readonly<Record<string, string>>;
};
type FetchInstrumentation = {
  readonly endpoint: string;
  readonly queue: EventQueue;
  readonly routes: Readonly<Record<string, string>>;
  readonly send: typeof fetch;
};
type HttpObservation = {
  readonly duration: number;
  readonly method: HttpMethod;
  readonly requestId: string;
  readonly route: string;
  readonly spanId: string;
  readonly start: number;
  readonly status: number;
  readonly traceId: string;
};

const flushIntervalMilliseconds = 3000;

const exportTimeoutMilliseconds = 5000;

const deliverEvents = async (
  send: typeof fetch,
  endpoint: string,
  events: readonly BrowserEvent[],
): Promise<void> => {
  const response = await send(endpoint, {
    body: JSON.stringify(events),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
    mode: "same-origin",
    redirect: "error",
    signal: AbortSignal.timeout(exportTimeoutMilliseconds),
  });
  if (!response.ok) {
    throw new Error(`Browser telemetry rejected (${response.status})`);
  }
};

const httpEvent = (observation: HttpObservation): BrowserEvent => {
  return { ...observation, kind: "http", name: "http.client.request", value: 0 };
};

const elapsed = (timer: number): number => {
  return Math.min(performance.now() - timer, maximumMeasurement);
};

const responseOutcome = (
  response: Readonly<Pick<Response, "status">> & {
    readonly headers: Readonly<Pick<Headers, "get">>;
  },
  fallbackRequestId: string,
): Pick<BrowserEvent, "requestId" | "status"> => {
  const serverRequestId = response.headers.get("x-request-id");
  return {
    requestId: isRequestId(serverRequestId) ? serverRequestId : fallbackRequestId,
    status: response.status,
  };
};

const tracedFetch = async (setup: FetchInstrumentation, request: Request): Promise<Response> => {
  const timer = performance.now();
  const span = {
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    traceId: randomHex(traceIdBytes),
  };
  request.headers.set("traceparent", `00-${span.traceId}-${span.spanId}-01`);
  const { pathname } = new URL(request.url);
  const outcome = { requestId: crypto.randomUUID(), status: 0 };
  try {
    const response = await setup.send(request);
    Object.assign(outcome, responseOutcome(response, outcome.requestId));
    return response;
  } finally {
    setup.queue.enqueue(
      httpEvent({
        ...outcome,
        ...span,
        duration: elapsed(timer),
        method: httpMethod(request.method),
        route: routeLabel(pathname, setup.routes),
      }),
    );
  }
};

const patchFetch = (setup: FetchInstrumentation): (() => void) => {
  const originalFetch = globalThis.fetch;
  const instrumentedFetch = async (
    input: RequestInfo | URL,

    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      globalThis.location.href,
    );
    if (url.origin !== globalThis.location.origin || url.pathname === setup.endpoint) {
      return setup.send(input, init);
    }
    return tracedFetch(setup, new Request(input instanceof Request ? input : url, init));
  };
  globalThis.fetch = instrumentedFetch;
  return () => {
    if (globalThis.fetch === instrumentedFetch) {
      globalThis.fetch = originalFetch;
    }
  };
};

const documentFields = (
  recorder: Recorder,
): Omit<Extract<BrowserEvent, { kind: "vital" }>, "kind" | "name" | "value"> => {
  return {
    ...recorder.documentContext,
    duration: 0,
    method: "GET",
    route: routeLabel(globalThis.location.pathname, recorder.routes),
    spanId: randomHex(spanIdBytes),
    start: Date.now(),
    status: 0,
  };
};

const recordException = (
  recorder: Recorder,
  name: "browser.error" | "browser.unhandledrejection",
  error: unknown,
): void => {
  const attributes = errorAttributes(error);
  recorder.queue.enqueue({
    ...documentFields(recorder),
    errorType: attributes["error.type"],
    kind: "exception",
    locations: attributes["error.locations"],
    name,
    value: 1,
  });
  recorder.queue.flushInBackground();
};

const listen = (recorder: Recorder): (() => void) => {
  const { queue } = recorder;
  const rejectionListener = (event: Readonly<Pick<PromiseRejectionEvent, "reason">>): void => {
    recordException(recorder, "browser.unhandledrejection", event.reason);
  };
  const visibilityListener = (): void => {
    if (document.visibilityState === "hidden") {
      queue.flushBeforeUnload();
    }
  };
  const pageHideListener = (): void => {
    queue.flushBeforeUnload();
  };
  const errorListener = (event: Readonly<Pick<ErrorEvent, "error">>): void => {
    recordException(recorder, "browser.error", event.error);
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

const observeVitals = (recorder: Recorder): void => {
  const recordVital = (metric: Readonly<Pick<Metric, "name" | "value">>): void => {
    const value = Math.min(Math.max(metric.value, 0), maximumMeasurement);
    recorder.queue.enqueue({
      ...documentFields(recorder),
      kind: "vital",
      name: metric.name,
      value,
    });
    if (!recorder.queue.disposed) {
      recorder.queue.flushInBackground();
    }
  };
  onCLS(recordVital, { reportAllChanges: true });
  onFCP(recordVital);
  onINP(recordVital, { reportAllChanges: true });
  onLCP(recordVital, { reportAllChanges: true });
  onTTFB(recordVital);
};

const assertRoutes = (routes: Readonly<Record<string, string>>): void => {
  if (!isRoutes(routes)) {
    throw new Error(routeMessage);
  }
};

const initBrowserTelemetry = (options: BrowserTelemetryOptions): BrowserTelemetry => {
  assertRoutes(options.routes);
  const { endpoint, routes } = options;
  const send = globalThis.fetch.bind(globalThis);
  const queue = new BrowserEventQueue(async (events) => {
    await deliverEvents(send, endpoint, events);
  });
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
  observeVitals(recorder);
  const interval = globalThis.setInterval(() => {
    queue.flushInBackground();
  }, flushIntervalMilliseconds);
  return {
    dispose: () => {
      queue.close();
      globalThis.clearInterval(interval);
      restoreFetch();
      stopListening();
      queue.flushInBackground();
    },
    flush: async () => {
      await queue.flush();
    },
  };
};

export { initBrowserTelemetry };
