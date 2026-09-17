import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import type { Metric } from "web-vitals";
import * as v from "valibot";
import { httpMethod, randomHex, requestIdSchema, routeLabel, validateRoutes } from "./protocol.ts";
import { errorAttributes } from "./errors.ts";
import type { BrowserEvent } from "./events.ts";

export type BrowserTelemetryOptions = {
  endpoint: "/api/telemetry";
  routes: Readonly<Record<string, string>>;
};

export function initBrowserTelemetry(options: BrowserTelemetryOptions) {
  if (options.endpoint !== "/api/telemetry")
    throw new Error("Browser telemetry must use the same-origin telemetry endpoint");
  validateRoutes(options.routes);
  const originalFetch = window.fetch;
  const send = originalFetch.bind(window);
  const pending: BrowserEvent[] = [];
  const documentContext = {
    traceId: randomHex(16),
    spanId: randomHex(8),
    requestId: crypto.randomUUID(),
  };
  let disposed = false;
  let active: Promise<void> | undefined;

  function reportFailure() {
    console.error(JSON.stringify({ event: "browser.telemetry_export_failed" }));
  }

  function enqueue(event: BrowserEvent) {
    if (disposed) return;
    if (pending.length >= 128) {
      console.error(JSON.stringify({ event: "browser.telemetry_queue_full" }));
      return;
    }
    pending.push(event);
  }

  async function deliver(events: BrowserEvent[]) {
    const response = await send(options.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      body: JSON.stringify(events),
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Browser telemetry rejected (${response.status})`);
  }

  function flush(): Promise<void> {
    if (active) return active;
    active = (async () => {
      while (pending.length > 0) {
        const events = pending.splice(0, 32);
        try {
          await deliver(events);
        } catch (error) {
          pending.unshift(...events);
          throw error;
        }
      }
    })().finally(() => {
      active = undefined;
    });
    return active;
  }

  function flushBeforeUnload() {
    while (pending.length > 0) void deliver(pending.splice(0, 32)).catch(reportFailure);
  }

  const instrumentedFetch: typeof window.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin !== window.location.origin || url.pathname === options.endpoint)
      return send(input, init);
    const start = Date.now();
    const timer = performance.now();
    const request = new Request(input instanceof Request ? input : url, init);
    const spanId = randomHex(8);
    const traceId = randomHex(16);
    request.headers.set("traceparent", `00-${traceId}-${spanId}-01`);
    let status = 0;
    let requestId: string = crypto.randomUUID();
    try {
      const response = await send(request);
      status = response.status;
      const serverRequestId = response.headers.get("x-request-id");
      if (v.is(requestIdSchema, serverRequestId)) requestId = serverRequestId;
      return response;
    } finally {
      enqueue({
        kind: "http",
        route: routeLabel(url.pathname, options.routes),
        start,
        duration: Math.min(performance.now() - timer, 600_000),
        status,
        method: httpMethod(request.method),
        name: "http.client.request",
        value: 0,
        traceId,
        spanId,
        requestId,
      });
    }
  };
  window.fetch = instrumentedFetch;

  function recordException(name: "browser.error" | "browser.unhandledrejection", error: unknown) {
    const attributes = errorAttributes(error);
    enqueue({
      ...documentContext,
      spanId: randomHex(8),
      kind: "exception",
      route: routeLabel(window.location.pathname, options.routes),
      start: Date.now(),
      duration: 0,
      status: 0,
      method: "GET",
      name,
      value: 1,
      errorType: attributes["error.type"],
      locations: attributes["error.locations"],
    });
    void flush().catch(reportFailure);
  }
  const errorListener = (event: ErrorEvent) => {
    recordException("browser.error", event.error);
  };
  const rejectionListener = (event: PromiseRejectionEvent) => {
    recordException("browser.unhandledrejection", event.reason);
  };
  const visibilityListener = () => {
    if (document.visibilityState === "hidden") flushBeforeUnload();
  };
  const pageHideListener = () => {
    flushBeforeUnload();
  };
  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", rejectionListener);
  window.addEventListener("pagehide", pageHideListener);
  document.addEventListener("visibilitychange", visibilityListener);

  function recordVital(metric: Metric) {
    enqueue({
      ...documentContext,
      spanId: randomHex(8),
      kind: "vital",
      route: routeLabel(window.location.pathname, options.routes),
      start: Date.now(),
      duration: 0,
      status: 0,
      method: "GET",
      name: metric.name,
      value: Math.min(Math.max(metric.value, 0), 600_000),
    });
    if (!disposed) void flush().catch(reportFailure);
  }
  onCLS(recordVital, { reportAllChanges: true });
  onFCP(recordVital);
  onINP(recordVital, { reportAllChanges: true });
  onLCP(recordVital, { reportAllChanges: true });
  onTTFB(recordVital);
  const interval = window.setInterval(() => {
    void flush().catch(reportFailure);
  }, 3000);

  function dispose() {
    disposed = true;
    window.clearInterval(interval);
    if (window.fetch === instrumentedFetch) window.fetch = originalFetch;
    window.removeEventListener("error", errorListener);
    window.removeEventListener("unhandledrejection", rejectionListener);
    window.removeEventListener("pagehide", pageHideListener);
    document.removeEventListener("visibilitychange", visibilityListener);
    void flush().catch(reportFailure);
  }
  return { flush, dispose };
}
