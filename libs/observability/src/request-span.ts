import {
  httpMethod,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  traceIdBytes,
} from "./protocol.ts";
import type { Application } from "@template/config";
import type { Correlation } from "./protocol.ts";
import type { LogSink } from "./log.ts";
import { errorAttributes } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { writeLog } from "./log.ts";

interface RequestContext extends Correlation {
  readonly traceparent: string;
}
interface Telemetry {
  readonly log: LogSink;
  readonly release: string;
  readonly routes: Readonly<Record<string, string>>;
  readonly serviceName: Application;
}
type RequestHandler = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  context: RequestContext,
) => Response | Promise<Response>;
interface Completion {
  readonly context: RequestContext;
  readonly status: number;
  readonly timer: number;
}

function correlationFields(telemetry: Telemetry, context: Correlation): Record<string, string> {
  return {
    release: telemetry.release,
    request_id: context.requestId,
    service: `${telemetry.serviceName}-server`,
    span_id: context.spanId,
    trace_id: context.traceId,
  };
}

function reportError(telemetry: Telemetry, context: RequestContext, error: unknown): void {
  writeLog(telemetry.log, "error", {
    event: "application.error",
    ...correlationFields(telemetry, context),
    ...errorAttributes(error),
  });
}

function incomingContext(request: {
  readonly headers: Readonly<Pick<Headers, "get">>;
}): RequestContext {
  const traceId =
    parentContext(request.headers.get("traceparent"))?.traceId ?? randomHex(traceIdBytes);
  const spanId = randomHex(spanIdBytes);
  return {
    requestId: crypto.randomUUID(),
    spanId,
    traceId,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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

function recordRequest(
  telemetry: Telemetry,
  request: Readonly<Pick<Request, "method" | "url">>,
  completion: Completion,
): void {
  const { context, status } = completion;
  const level = status >= httpStatus.internalServerError ? "error" : "info";
  writeLog(telemetry.log, level, {
    event: "http.server.request",
    ...correlationFields(telemetry, context),
    duration_ms: performance.now() - completion.timer,
    method: httpMethod(request.method),
    route: routeLabel(new URL(request.url).pathname, telemetry.routes),
    status,
  });
}

async function wrapRequest(
  telemetry: Telemetry,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  handler: RequestHandler,
): Promise<Response> {
  const timer = performance.now();
  const context = incomingContext(request);
  const observed: { status: number } = { status: httpStatus.internalServerError };
  try {
    const response = await handler(request, context);
    observed.status = response.status;
    return correlatedResponse(response, context);
  } catch (error) {
    reportError(telemetry, context, error);
    throw error;
  } finally {
    recordRequest(telemetry, request, { context, status: observed.status, timer });
  }
}

export { reportError, wrapRequest };
export type { RequestContext, RequestHandler, Telemetry };
