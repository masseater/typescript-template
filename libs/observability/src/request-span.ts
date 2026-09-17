import type { RequestContext, Telemetry, Timing } from "./telemetry.ts";
import { durationMetric, enqueueServer, traceparent } from "./telemetry.ts";
import {
  httpMethod,
  logRecord,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  spanKind,
  spanRecord,
  traceIdBytes,
} from "./protocol.ts";
import { logError, logInfo } from "./log.ts";
import type { ExecutionContext } from "./exporter.ts";
import { errorAttributes } from "./errors.ts";
import { httpStatus } from "./http-status.ts";

type RequestHandler = (request: Request, context: RequestContext) => Response | Promise<Response>;
interface HttpObservation extends Timing {
  readonly context: RequestContext;
  readonly method: string;
  readonly route: string;
  readonly status: number;
  readonly parentSpanId: string | undefined;
}
interface IncomingContext {
  readonly context: RequestContext;
  readonly parentSpanId: string | undefined;
}
interface Handling {
  readonly handler: RequestHandler;
  readonly executionContext: ExecutionContext | undefined;
}

function recordHttp(telemetry: Telemetry, observation: HttpObservation): void {
  const { context, duration, method, parentSpanId, route, start, status } = observation;
  const end = start + duration;
  const values = {
    "http.request.method": method,
    "http.response.status_code": status,
    "http.route": route,
  };
  const failed = status >= httpStatus.internalServerError;
  const name = `${method} ${route}`;
  const kind = spanKind.server;
  const logValues = { ...values, "duration.ms": duration };
  enqueueServer(telemetry, [
    {
      record: spanRecord({ context, end, failed, kind, name, parentSpanId, start, values }),
      signal: "traces",
    },
    {
      record: logRecord({
        context,
        failed,
        name: "http.server.request",
        time: end,
        values: logValues,
      }),
      signal: "logs",
    },
    {
      record: durationMetric("http.server.request.duration", values, observation),
      signal: "metrics",
    },
  ]);
  logInfo({
    duration_ms: duration,
    event: "http.server.request",
    method,
    request_id: context.requestId,
    route,
    service: `${telemetry.serviceName}-server`,
    span_id: context.spanId,
    status,
    trace_id: context.traceId,
  });
}

function reportError(telemetry: Telemetry, context: RequestContext, error: unknown): void {
  const values = errorAttributes(error);
  const time = Date.now();
  enqueueServer(telemetry, [
    {
      record: logRecord({ context, failed: true, name: "application.error", time, values }),
      signal: "logs",
    },
  ]);
  logError({
    event: "application.error",
    request_id: context.requestId,
    service: `${telemetry.serviceName}-server`,
    span_id: context.spanId,
    trace_id: context.traceId,
    ...values,
  });
}

function incomingContext(request: Request): IncomingContext {
  const parent = parentContext(request.headers.get("traceparent"));
  const traceId = parent?.traceId ?? randomHex(traceIdBytes);
  const spanId = randomHex(spanIdBytes);
  return {
    context: {
      requestId: crypto.randomUUID(),
      spanId,
      traceId,
      traceparent: traceparent(traceId, spanId),
    },
    parentSpanId: parent?.parentSpanId,
  };
}

function correlatedResponse(response: Response, context: RequestContext): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", context.requestId);
  headers.set("traceparent", context.traceparent);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function finishRequest(
  telemetry: Telemetry,
  request: Request,
  outcome: IncomingContext &
    Handling & { readonly start: number; readonly status: number; readonly timer: number },
): void {
  recordHttp(telemetry, {
    context: outcome.context,
    duration: performance.now() - outcome.timer,
    method: httpMethod(request.method),
    parentSpanId: outcome.parentSpanId,
    route: routeLabel(new URL(request.url).pathname, telemetry.routes),
    start: outcome.start,
    status: outcome.status,
  });
  telemetry.exporter.flushInBackground(outcome.executionContext);
}

async function wrapRequest(
  telemetry: Telemetry,
  request: Request,
  handling: Handling,
): Promise<Response> {
  const clock = { start: Date.now(), timer: performance.now() };
  const incoming = incomingContext(request);
  const observed: { status: number } = { status: httpStatus.internalServerError };
  try {
    const response = await handling.handler(request, incoming.context);
    observed.status = response.status;
    return correlatedResponse(response, incoming.context);
  } catch (error) {
    reportError(telemetry, incoming.context, error);
    throw error;
  } finally {
    finishRequest(telemetry, request, {
      ...handling,
      ...incoming,
      ...clock,
      status: observed.status,
    });
  }
}

export { reportError, wrapRequest };
export type { RequestHandler };
