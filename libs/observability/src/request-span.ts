import { Cause, Context, Effect, Tracer } from "effect";

import { CurrentRequest, type RequestContext } from "./current-request.ts";
import { errorAttributes, errorFingerprint, type ErrorAttributes } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { httpMethod, parentContext, routeLabel } from "./protocol.ts";
import { isRecord } from "./structured-logs.ts";
import { Telemetry } from "./telemetry.ts";

type Entropy = {
  readonly requestId: () => string;
  readonly epochMilliseconds: () => number;
  readonly monotonicMilliseconds: () => number;
};

export const RequestEntropy = Context.Reference<Entropy>("@repo/observability/RequestEntropy", {
  defaultValue: () => ({
    epochMilliseconds: () => Date.now(),
    monotonicMilliseconds: () => performance.now(),
    requestId: () => crypto.randomUUID(),
  }),
});

const incomingParent = (
  headers: Readonly<Pick<Headers, "get">>,
): Tracer.ExternalSpan | undefined => {
  const parent = parentContext(headers.get("traceparent"));
  return parent === undefined
    ? undefined
    : Tracer.externalSpan({ spanId: parent.parentSpanId, traceId: parent.traceId });
};

const requestContextOf = (observed: {
  readonly entropy: Entropy;
  readonly span: Readonly<Pick<Tracer.Span, "spanId" | "traceId">>;
}): RequestContext => {
  const { entropy, span } = observed;
  return {
    requestId: entropy.requestId(),
    spanId: span.spanId,
    traceId: span.traceId,
    traceparent: `00-${span.traceId}-${span.spanId}-01`,
  };
};

const correlatedResponse = (correlated: {
  readonly handled: Response;
  readonly requestContext: RequestContext;
}): Response => {
  const { handled, requestContext } = correlated;
  return new Response(handled.body, {
    headers: new Headers([
      ...[...handled.headers.entries()].filter(
        ([headerName]) => headerName !== "x-request-id" && headerName !== "traceparent",
      ),
      ["x-request-id", requestContext.requestId],
      ["traceparent", requestContext.traceparent],
    ]),
    status: handled.status,
    statusText: handled.statusText,
  });
};

const tagPattern = /^[A-Za-z]{1,64}$/u;

export const failureAttributesOf = (
  failed: unknown,
): ErrorAttributes & { readonly "error.tag"?: string } => {
  const attributes = errorAttributes(failed);
  const failureTag = isRecord(failed) ? failed._tag : undefined;
  if (typeof failureTag !== "string" || !tagPattern.test(failureTag)) {
    return attributes;
  }
  const fingerprint = errorFingerprint({
    errorType: attributes["error.type"],
    locations: `${failureTag}\n${attributes["error.locations"]}`,
  });
  return { ...attributes, "error.fingerprint": fingerprint, "error.tag": failureTag };
};

export const reportFailure = (cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<void> => {
  return Effect.logError("application.error").pipe(
    Effect.annotateLogs({ ...failureAttributesOf(Cause.squash(cause)) }),
  );
};

const failureMessage = "処理に失敗しました。リクエスト ID でログを確認してください。";

const failureResponse = (cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<Response> => {
  return reportFailure(cause).pipe(
    Effect.as(
      Response.json(
        { error: failureMessage },
        { headers: { "cache-control": "no-store" }, status: httpStatus.internalServerError },
      ),
    ),
  );
};

const recordRequest = Effect.fn("recordRequest")(function* recordRequest(served: {
  readonly incoming: Readonly<Pick<Request, "method" | "url">>;
  readonly responseStatus: number;
  readonly startedAt: number;
}) {
  const telemetry = yield* Telemetry;
  const entropy = yield* RequestEntropy;
  const attributes = {
    duration_ms: entropy.monotonicMilliseconds() - served.startedAt,
    method: httpMethod(served.incoming.method),
    route: routeLabel(new URL(served.incoming.url).pathname, telemetry.routes),
    status: served.responseStatus,
  };
  yield* Effect.annotateCurrentSpan(attributes);
  yield* (
    served.responseStatus >= httpStatus.internalServerError
      ? Effect.logError("http.server.request")
      : Effect.logInfo("http.server.request")
  ).pipe(Effect.annotateLogs(attributes));
});

const respond = <Requirements>(served: {
  readonly incoming: Request;
  readonly requestContext: RequestContext;
  readonly entropy: Entropy;
  readonly handle: (
    incoming: Request,
  ) => Effect.Effect<Response, never, Requirements | CurrentRequest>;
}): Effect.Effect<Response, never, Telemetry | Exclude<Requirements, CurrentRequest>> => {
  const { entropy, handle, incoming, requestContext } = served;
  return Effect.gen(function* respondProgram() {
    const startedAt = entropy.monotonicMilliseconds();
    const handled = yield* handle(incoming).pipe(
      Effect.provideService(CurrentRequest, requestContext),
      Effect.catchCause(failureResponse),
    );
    yield* recordRequest({ incoming, responseStatus: handled.status, startedAt });
    return correlatedResponse({ handled, requestContext });
  }).pipe(
    Effect.annotateLogs({
      request_id: requestContext.requestId,
      span_id: requestContext.spanId,
      trace_id: requestContext.traceId,
    }),
  );
};

export const observeRequest = <Requirements>(
  incoming: Request,
  handle: (incoming: Request) => Effect.Effect<Response, never, Requirements | CurrentRequest>,
): Effect.Effect<Response, never, Telemetry | Exclude<Requirements, CurrentRequest>> => {
  return Effect.gen(function* observe() {
    const entropy = yield* RequestEntropy;
    const span = yield* Effect.orDie(Effect.currentSpan);
    return yield* respond({
      entropy,
      handle,
      incoming,
      requestContext: requestContextOf({ entropy, span }),
    });
  }).pipe(
    Effect.withSpan("http.server.request", {
      kind: "server",
      parent: incomingParent(incoming.headers),
    }),
  );
};
