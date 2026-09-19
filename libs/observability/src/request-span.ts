import { Cause, Effect, Tracer } from "effect";

import { annotateLogs, annotateSpan } from "./annotations.ts";
import { CurrentRequest } from "./current-request.ts";
import {
  errorAttributes,
  errorFingerprint,
  fingerprintIdentity,
  identifierPattern,
} from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { httpMethod, parentContext, routeLabel } from "./protocol.ts";
import { logAt, statusSeverity } from "./severity.ts";
import { isRecord } from "./structured-logs.ts";
import { Telemetry } from "./telemetry.ts";

import type { RequestContext } from "./current-request.ts";
import type { ErrorAttributes } from "./errors.ts";

type RequestHandler<Requirements> = (
  request: Request,
) => Effect.Effect<Response, never, Requirements | CurrentRequest>;
type FailureAttributes = ErrorAttributes & { readonly "error.tag"?: string };

const failureMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";

function failureTag(error: unknown): string | undefined {
  const tag = isRecord(error) ? error["_tag"] : undefined;
  return typeof tag === "string" && identifierPattern.test(tag) ? tag : undefined;
}

function failureAttributesOf(error: unknown): FailureAttributes {
  const attributes = errorAttributes(error);
  const tag = failureTag(error);
  if (tag === undefined) {
    return attributes;
  }
  const fingerprint = errorFingerprint(
    fingerprintIdentity(error),
    `${tag}\n${attributes["error.locations"]}`,
  );
  return { ...attributes, "error.fingerprint": fingerprint, "error.tag": tag };
}

function reportFailure(cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<void> {
  const attributes = failureAttributesOf(Cause.squash(cause));
  return Effect.logError("application.error").pipe(annotateLogs({ ...attributes }));
}

function incomingParent(headers: Readonly<Pick<Headers, "get">>): Tracer.ExternalSpan | undefined {
  const parent = parentContext(headers.get("traceparent"));
  return parent === undefined
    ? undefined
    : Tracer.externalSpan({ spanId: parent.parentSpanId, traceId: parent.traceId });
}

function requestContext(span: Readonly<Pick<Tracer.Span, "spanId" | "traceId">>): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    spanId: span.spanId,
    traceId: span.traceId,
    traceparent: `00-${span.traceId}-${span.spanId}-01`,
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

function recordRequest(
  request: Readonly<Pick<Request, "method" | "url">>,
  status: number,
  start: number,
): Effect.Effect<void, never, Telemetry> {
  return Effect.gen(function* recordRequestProgram() {
    const telemetry = yield* Telemetry;
    const attributes = {
      duration_ms: performance.now() - start,
      method: httpMethod(request.method),
      route: routeLabel(new URL(request.url).pathname, telemetry.routes),
      status,
    };
    yield* annotateSpan(attributes);
    yield* logAt(statusSeverity(status), "http.server.request", attributes);
  });
}

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
  }).pipe(
    annotateLogs({
      request_id: context.requestId,
      span_id: context.spanId,
      trace_id: context.traceId,
    }),
  );
}

function observeRequest<Requirements>(
  request: Request,
  handler: RequestHandler<Requirements>,
): Effect.Effect<Response, never, Telemetry | Exclude<Requirements, CurrentRequest>> {
  return Effect.orDie(Effect.currentSpan).pipe(
    Effect.flatMap((span) => respond(request, requestContext(span), handler)),
    Effect.withSpan("http.server.request", {
      kind: "server",
      parent: incomingParent(request.headers),
    }),
  );
}

export { failureAttributesOf, observeRequest, reportFailure };
