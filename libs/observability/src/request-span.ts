import { Cause, Effect } from "effect";
import { errorAttributes, errorFingerprint } from "./errors.ts";
import {
  httpMethod,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  traceIdBytes,
} from "./protocol.ts";
import { CurrentRequest } from "./current-request.ts";
import type { ErrorAttributes } from "./errors.ts";
import type { RequestContext } from "./current-request.ts";
import { Telemetry } from "./telemetry.ts";
import { httpStatus } from "./http-status.ts";
import { isRecord } from "./structured-logs.ts";

type RequestHandler<Requirements> = (
  request: Request,
) => Effect.Effect<Response, never, Requirements | CurrentRequest>;
type FailureAttributes = ErrorAttributes & { readonly "error.tag"?: string };

const tagPattern = /^[A-Za-z]{1,64}$/u;
const failureMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";

function failureTag(error: unknown): string | undefined {
  const tag = isRecord(error) ? error["_tag"] : undefined;
  return typeof tag === "string" && tagPattern.test(tag) ? tag : undefined;
}

function failureAttributesOf(error: unknown): FailureAttributes {
  const attributes = errorAttributes(error);
  const tag = failureTag(error);
  if (tag === undefined) {
    return attributes;
  }
  const fingerprint = errorFingerprint(
    attributes["error.type"],
    `${tag}\n${attributes["error.locations"]}`,
  );
  return { ...attributes, "error.fingerprint": fingerprint, "error.tag": tag };
}

function reportFailure(cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<void> {
  return Effect.logError("application.error", failureAttributesOf(Cause.squash(cause)));
}

function incomingContext(headers: Readonly<Pick<Headers, "get">>): RequestContext {
  const traceId = parentContext(headers.get("traceparent"))?.traceId ?? randomHex(traceIdBytes);
  const spanId = randomHex(spanIdBytes);
  return {
    requestId: crypto.randomUUID(),
    spanId,
    traceId,
    traceparent: `00-${traceId}-${spanId}-01`,
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

function failureResponse(cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<Response> {
  return reportFailure(cause).pipe(
    Effect.as(
      Response.json(
        { error: failureMessage },
        { headers: { "cache-control": "no-store" }, status: httpStatus.internalServerError },
      ),
    ),
  );
}

const recordRequest = Effect.fn("recordRequest")(function* recordRequest(
  request: Readonly<Pick<Request, "method" | "url">>,
  status: number,
  start: number,
) {
  const telemetry = yield* Telemetry;
  const attributes = {
    duration_ms: performance.now() - start,
    method: httpMethod(request.method),
    route: routeLabel(new URL(request.url).pathname, telemetry.routes),
    status,
  };
  yield* status >= httpStatus.internalServerError
    ? Effect.logError("http.server.request", attributes)
    : Effect.logInfo("http.server.request", attributes);
});

function respond<Requirements>(
  request: Request,
  context: RequestContext,
  handler: RequestHandler<Requirements>,
): Effect.Effect<Response, never, Exclude<Requirements, CurrentRequest> | Telemetry> {
  return Effect.gen(function* respondProgram() {
    const start = performance.now();
    const response = yield* handler(request).pipe(
      Effect.provideService(CurrentRequest, context),
      Effect.catchCause(failureResponse),
    );
    yield* recordRequest(request, response.status, start);
    return correlatedResponse(response, context);
  });
}

function observeRequest<Requirements>(
  request: Request,
  handler: RequestHandler<Requirements>,
): Effect.Effect<Response, never, Telemetry | Exclude<Requirements, CurrentRequest>> {
  return Effect.suspend(() => {
    const context = incomingContext(request.headers);
    return respond(request, context, handler).pipe(
      Effect.annotateLogs({
        request_id: context.requestId,
        span_id: context.spanId,
        trace_id: context.traceId,
      }),
    );
  });
}

export { failureAttributesOf, observeRequest, reportFailure };
