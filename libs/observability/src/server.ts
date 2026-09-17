import { httpMethod, parentContext, randomHex, routeLabel, validateRoutes } from "./protocol.ts";
import type { Application } from "@template/config";
import type { Correlation } from "./protocol.ts";
import { parseBrowserEvents } from "./events.ts";
import { errorAttributes, errorFingerprint } from "./errors.ts";
import * as v from "valibot";
import { clientErrorSchema, readJson } from "./request.ts";

export type { Correlation } from "./protocol.ts";
export { clientErrorSchema, readJson } from "./request.ts";
export type RequestContext = Correlation & { traceparent: string };
export type InstrumentationOptions = {
  serviceName: Application;
  release: string;
  routes: Readonly<Record<string, string>>;
  log?: { info(line: string): void; error(line: string): void };
};

const ingressWindows = new Map<Application, { start: number; count: number }>();

export function createInstrumentation(options: InstrumentationOptions) {
  validateRoutes(options.routes);
  const labels = new Set([...Object.values(options.routes), "unmatched"]);
  const log = options.log ?? console;

  function reportError(context: RequestContext, error: unknown) {
    log.error(
      JSON.stringify({
        event: "application.error",
        service: `${options.serviceName}-server`,
        release: options.release,
        request_id: context.requestId,
        trace_id: context.traceId,
        span_id: context.spanId,
        ...errorAttributes(error),
      }),
    );
  }

  async function wrapRequest(
    request: Request,
    handler: (request: Request, context: RequestContext) => Response | Promise<Response>,
  ): Promise<Response> {
    const start = performance.now();
    const traceId = parentContext(request.headers.get("traceparent"))?.traceId ?? randomHex(16);
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
      log[status >= 500 ? "error" : "info"](
        JSON.stringify({
          event: "http.server.request",
          service: `${options.serviceName}-server`,
          release: options.release,
          request_id: context.requestId,
          trace_id: context.traceId,
          span_id: context.spanId,
          method: httpMethod(request.method),
          route: routeLabel(new URL(request.url).pathname, options.routes),
          status,
          duration_ms: performance.now() - start,
        }),
      );
    }
  }

  async function ingestBrowser(request: Request): Promise<Response> {
    const headers = { "cache-control": "no-store" };
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { ...headers, allow: "POST" } });
    let events;
    try {
      events = parseBrowserEvents(
        await readJson(request, new URL(request.url).origin, 32_768),
        labels,
        Date.now(),
      );
    } catch (error) {
      const status = v.is(clientErrorSchema, error) ? error.statusCode : 400;
      return new Response(null, { status, headers });
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
      const failed =
        event.kind === "exception" ||
        (event.kind === "http" && (event.status === 0 || event.status >= 400));
      log[failed ? "error" : "info"](
        JSON.stringify({
          event: event.name,
          service: `${options.serviceName}-browser`,
          release: options.release,
          request_id: event.requestId,
          trace_id: event.traceId,
          span_id: event.spanId,
          "telemetry.source": "untrusted-browser",
          "http.route": event.route,
          ...(event.kind === "http"
            ? { "http.request.method": event.method, "http.response.status_code": event.status }
            : {}),
          ...(event.kind === "exception"
            ? {
                "error.type": event.errorType,
                "error.locations": event.locations,
                "error.fingerprint": errorFingerprint(event.errorType, event.locations),
              }
            : {}),
          duration_ms: event.duration,
          measurement_value: event.value,
          start: new Date(event.start).toISOString(),
        }),
      );
    }
    return new Response(null, { status: 202, headers });
  }

  return { wrapRequest, reportError, ingestBrowser };
}
