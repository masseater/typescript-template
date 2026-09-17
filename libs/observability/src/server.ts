import {
  envelope,
  createMetricAccumulator,
  histogram,
  httpMethod,
  logRecord,
  parentContext,
  randomHex,
  routeLabel,
  spanRecord,
  validateRoutes,
} from "./protocol.ts";
import type { Attributes, Correlation, ServiceName, Signal } from "./protocol.ts";
import { parseBrowserEvents } from "./events.ts";
import { externalAttributes } from "./external.ts";
import { errorAttributes } from "./errors.ts";

export type { Correlation, ServiceName } from "./protocol.ts";
export type ExecutionContext = { waitUntil(promise: Promise<unknown>): void };
export type RequestContext = Correlation & { traceparent: string };
export type InstrumentationOptions = {
  serviceName: ServiceName;
  endpoint: string;
  headers?: Readonly<Record<string, string>>;
  routes: Readonly<Record<string, string>>;
};

type TelemetryRecord =
  | ReturnType<typeof histogram>
  | ReturnType<typeof logRecord>
  | ReturnType<typeof spanRecord>;
type Batch = { signal: Signal; records: TelemetryRecord[]; runtime: "browser" | "server" };
const ingressWindows = new Map<ServiceName, { start: number; count: number }>();
const accumulateMetrics = createMetricAccumulator();

class ExportError extends Error {
  readonly retryable: boolean;
  readonly delay: number;

  constructor(retryable: boolean, delay = 0) {
    super("OTLP export failed");
    this.retryable = retryable;
    this.delay = delay;
  }
}

export function createInstrumentation(options: InstrumentationOptions) {
  const endpoint = new URL(options.endpoint);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error("Invalid OTLP endpoint");
  if (!["user", "admin"].includes(options.serviceName))
    throw new Error("Invalid telemetry service");
  validateRoutes(options.routes);
  const queue: Batch[] = [];
  const labels = new Set([...Object.values(options.routes), "unmatched"]);
  let active: Promise<void> | undefined;
  let droppedRecords = 0;
  let exportFailures = 0;

  function enqueue(signal: Signal, records: TelemetryRecord[], runtime: "browser" | "server") {
    if (queue.length >= 192) {
      droppedRecords += records.length;
      console.error(
        JSON.stringify({
          event: "telemetry.queue_full",
          service: options.serviceName,
          dropped_records: droppedRecords,
        }),
      );
      return;
    }
    queue.push({ signal, records, runtime });
  }

  async function exportBatch(batch: Batch, body: string, timeout: number) {
    const response = await fetch(`${endpoint.href.replace(/\/$/, "")}/v1/${batch.signal}`, {
      method: "POST",
      headers: { ...options.headers, "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(timeout),
      redirect: "manual",
    });
    if (!response.ok) {
      const retryAfter = response.headers.get("retry-after");
      const delay =
        retryAfter === null
          ? 0
          : /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : Math.max(0, Date.parse(retryAfter) - Date.now());
      await response.body?.cancel();
      throw new ExportError(
        [429, 502, 503, 504].includes(response.status),
        Number.isFinite(delay) ? delay : 0,
      );
    }
    const text = await response.text();
    if (text) {
      let result: unknown;
      try {
        result = JSON.parse(text) as unknown;
      } catch {
        throw new ExportError(false);
      }
      if (result && typeof result === "object" && "partialSuccess" in result) {
        const partial = result.partialSuccess;
        if (
          partial &&
          typeof partial === "object" &&
          Object.values(partial).some((value) => value !== "0" && value !== 0 && value !== "")
        )
          throw new ExportError(false);
      }
    }
  }

  function flush(): Promise<void> {
    if (active) return active;
    active = (async () => {
      const deadline = Date.now() + 20_000;
      let failed = false;
      while (queue.length > 0) {
        const batch = queue[0];
        if (!batch) break;
        const group = queue.filter(
          (item) => item.signal === batch.signal && item.runtime === batch.runtime,
        );
        const records = group.flatMap((item) => item.records);
        const exported =
          batch.signal === "metrics"
            ? accumulateMetrics(
                records.filter((record) => "histogram" in record),
                `${options.serviceName}-${batch.runtime}`,
                Date.now(),
              )
            : records;
        const body = JSON.stringify(
          envelope(batch.signal, exported, options.serviceName, batch.runtime),
        );
        let delivered = false;
        for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt += 1) {
          try {
            await exportBatch(batch, body, Math.max(1, Math.min(3000, deadline - Date.now())));
            delivered = true;
            break;
          } catch (error) {
            if (error instanceof ExportError && !error.retryable) break;
            const delay = Math.max(
              250 * 2 ** attempt,
              error instanceof ExportError ? error.delay : 0,
            );
            if (attempt === 2 || Date.now() + delay >= deadline) break;
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
        if (!delivered) {
          failed = true;
          droppedRecords += records.length;
        }
        for (const item of group) {
          const index = queue.indexOf(item);
          if (index >= 0) queue.splice(index, 1);
        }
      }
      if (failed) throw new Error("Telemetry export exhausted its retry budget");
    })()
      .catch(() => {
        exportFailures += 1;
        console.error(
          JSON.stringify({
            event: "telemetry.export_failed",
            service: options.serviceName,
            pending: queue.length,
          }),
        );
        throw new Error("Telemetry export exhausted its retry budget; undelivered records dropped");
      })
      .finally(() => {
        active = undefined;
      });
    return active;
  }

  function flushInBackground(executionContext?: ExecutionContext) {
    const promise = flush().catch(() => {
      console.error(
        JSON.stringify({
          event: "telemetry.background_export_failed",
          service: options.serviceName,
          export_failures: exportFailures,
        }),
      );
    });
    if (executionContext) executionContext.waitUntil(promise);
    else void promise;
  }

  function metric(
    name: string,
    unit: string,
    value: number,
    values: Attributes,
    start: number,
    end: number,
    context: Correlation,
  ) {
    return histogram(name, unit, value, values, start, end, context);
  }

  function recordHttp(
    context: RequestContext,
    method: string,
    route: string,
    status: number,
    start: number,
    duration: number,
    parentSpanId?: string,
  ) {
    const end = start + duration;
    const values = {
      "http.request.method": method,
      "http.route": route,
      "http.response.status_code": status,
    };
    const failed = status >= 500;
    enqueue(
      "traces",
      [spanRecord(`${method} ${route}`, values, context, start, end, 2, failed, parentSpanId)],
      "server",
    );
    enqueue(
      "logs",
      [
        logRecord(
          "http.server.request",
          { ...values, "duration.ms": duration },
          context,
          end,
          failed,
        ),
      ],
      "server",
    );
    enqueue(
      "metrics",
      [metric("http.server.request.duration", "s", duration / 1000, values, start, end, context)],
      "server",
    );
    console.info(
      JSON.stringify({
        event: "http.server.request",
        service: `${options.serviceName}-server`,
        request_id: context.requestId,
        trace_id: context.traceId,
        span_id: context.spanId,
        method,
        route,
        status,
        duration_ms: duration,
      }),
    );
  }

  async function wrapRequest(
    request: Request,
    handler: (request: Request, context: RequestContext) => Response | Promise<Response>,
    executionContext?: ExecutionContext,
  ): Promise<Response> {
    const start = Date.now();
    const timer = performance.now();
    const parent = parentContext(request.headers.get("traceparent"));
    const traceId = parent?.traceId ?? randomHex(16);
    const spanId = randomHex(8);
    const context: RequestContext = {
      traceId,
      spanId,
      requestId: crypto.randomUUID(),
      traceparent: `00-${traceId}-${spanId}-01`,
    };
    let status = 500;
    try {
      const response = await handler(request, context);
      status = response.status;
      const headers = new Headers(response.headers);
      headers.set("x-request-id", context.requestId);
      headers.set("traceparent", context.traceparent);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      reportError(context, error);
      throw error;
    } finally {
      recordHttp(
        context,
        httpMethod(request.method),
        routeLabel(new URL(request.url).pathname, options.routes),
        status,
        start,
        performance.now() - timer,
        parent?.parentSpanId,
      );
      flushInBackground(executionContext);
    }
  }

  async function withExternalSpan<T>(
    context: RequestContext,
    operation: "email",
    action: (context: RequestContext) => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const timer = performance.now();
    const spanId = randomHex(8);
    const child = { ...context, spanId, traceparent: `00-${context.traceId}-${spanId}-01` };
    let status: number | undefined;
    let failed = true;
    try {
      const response = await action(child);
      if (response instanceof Response) status = response.status;
      failed = status !== undefined && status >= 400;
      return response;
    } finally {
      const duration = performance.now() - timer;
      const values = externalAttributes(operation, status, failed);
      enqueue(
        "traces",
        [
          spanRecord(
            `external.${operation}`,
            values,
            child,
            start,
            start + duration,
            3,
            failed,
            context.spanId,
          ),
        ],
        "server",
      );
      enqueue(
        "logs",
        [
          logRecord(
            `external.${operation}`,
            { ...values, "duration.ms": duration },
            child,
            start + duration,
            failed,
          ),
        ],
        "server",
      );
      enqueue(
        "metrics",
        [
          metric(
            "external.request.duration",
            "s",
            duration / 1000,
            values,
            start,
            start + duration,
            child,
          ),
        ],
        "server",
      );
    }
  }

  async function withDbSpan<T>(
    context: RequestContext,
    operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "MIGRATE" | "TRANSACTION" | "OTHER",
    action: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    const timer = performance.now();
    const child = { ...context, spanId: randomHex(8) };
    let failed = false;
    try {
      return await action();
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      const duration = performance.now() - timer;
      const values = { "db.system.name": "sqlite", "db.operation.name": operation };
      enqueue(
        "traces",
        [
          spanRecord(
            `db.${operation}`,
            values,
            child,
            start,
            start + duration,
            3,
            failed,
            context.spanId,
          ),
        ],
        "server",
      );
      enqueue(
        "metrics",
        [
          metric(
            "db.client.operation.duration",
            "s",
            duration / 1000,
            values,
            start,
            start + duration,
            child,
          ),
        ],
        "server",
      );
    }
  }

  async function ingestBrowser(
    request: Request,
    executionContext?: ExecutionContext,
  ): Promise<Response> {
    const headers = { "cache-control": "no-store" };
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { ...headers, allow: "POST" } });
    if (
      request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      return new Response(null, { status: 403, headers });
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
      return new Response(null, { status: 415, headers });
    if (Number(request.headers.get("content-length")) > 32768)
      return new Response(null, { status: 413, headers });
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return new Response(null, { status: 413, headers });
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let events;
    try {
      events = parseBrowserEvents(
        JSON.parse(new TextDecoder().decode(bytes)) as unknown,
        labels,
        Date.now(),
      );
    } catch {
      return new Response(null, { status: 400, headers });
    }
    const now = Date.now();
    const window = ingressWindows.get(options.serviceName) ?? { start: now, count: 0 };
    if (now - window.start > 60_000) {
      window.start = now;
      window.count = 0;
    }
    ingressWindows.set(options.serviceName, window);
    if (window.count + events.length > 1200)
      return new Response(null, { status: 429, headers: { ...headers, "retry-after": "60" } });
    window.count += events.length;
    for (const event of events) {
      const values: Attributes = {
        "http.route": event.route,
        "telemetry.source": "untrusted-browser",
      };
      if (event.kind === "http")
        Object.assign(values, {
          "http.request.method": event.method,
          "http.response.status_code": event.status,
        });
      const failed =
        event.kind === "exception" ||
        (event.kind === "http" && (event.status === 0 || event.status >= 400));
      const end = event.start + event.duration;
      enqueue(
        "logs",
        [
          logRecord(
            event.name,
            { ...values, "duration.ms": event.duration, "measurement.value": event.value },
            event,
            end,
            failed,
          ),
        ],
        "browser",
      );
      enqueue(
        "traces",
        [
          spanRecord(
            event.name,
            values,
            event,
            event.start,
            end,
            event.kind === "http" ? 3 : 1,
            failed,
          ),
        ],
        "browser",
      );
      enqueue(
        "metrics",
        [
          metric(
            event.kind === "http"
              ? "http.client.request.duration"
              : event.kind === "vital"
                ? `browser.web_vital.${event.name.toLowerCase()}`
                : "browser.exception",
            event.kind === "http"
              ? "s"
              : event.name === "CLS" || event.kind === "exception"
                ? "1"
                : "ms",
            event.kind === "http"
              ? event.duration / 1000
              : event.kind === "exception"
                ? 1
                : event.value,
            values,
            event.start,
            end,
            event,
          ),
        ],
        "browser",
      );
    }
    flushInBackground(executionContext);
    return new Response(null, { status: 202, headers });
  }

  const diagnostics = () => ({ queuedBatches: queue.length, droppedRecords, exportFailures });
  function reportError(context: RequestContext, error: unknown) {
    const values = errorAttributes(error);
    enqueue("logs", [logRecord("application.error", values, context, Date.now(), true)], "server");
    console.error(
      JSON.stringify({
        event: "application.error",
        service: `${options.serviceName}-server`,
        request_id: context.requestId,
        trace_id: context.traceId,
        span_id: context.spanId,
        ...values,
      }),
    );
  }

  return {
    wrapRequest,
    withDbSpan,
    withExternalSpan,
    reportError,
    ingestBrowser,
    flush,
    diagnostics,
  };
}
