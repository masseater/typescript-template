import { Cause, Context, Effect } from "effect";

import { CurrentRequest, type RequestContext } from "./current-request.ts";
import { errorAttributes, errorFingerprint, type ErrorAttributes } from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import {
  httpMethod,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  traceIdBytes,
} from "./protocol.ts";
import { isRecord } from "./structured-logs.ts";
import { Telemetry } from "./telemetry.ts";

type Entropy = {
  readonly requestId: () => string;
  readonly hex: (byteCount: number) => string;
  readonly epochMilliseconds: () => number;
  readonly monotonicMilliseconds: () => number;
};

export const RequestEntropy = Context.Reference<Entropy>("@template/observability/RequestEntropy", {
  defaultValue: () => ({
    epochMilliseconds: () => Date.now(),
    hex: randomHex,
    monotonicMilliseconds: () => performance.now(),
    requestId: () => crypto.randomUUID(),
  }),
});

const incomingContext = (incoming: {
  readonly entropy: Entropy;
  readonly headers: Readonly<Pick<Headers, "get">>;
}): RequestContext => {
  const { entropy } = incoming;
  const traceId =
    parentContext(incoming.headers.get("traceparent"))?.traceId ?? entropy.hex(traceIdBytes);
  const spanId = entropy.hex(spanIdBytes);
  return {
    requestId: entropy.requestId(),
    spanId,
    traceId,
    traceparent: `00-${traceId}-${spanId}-01`,
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

const failureAttributes = (
  cause: Readonly<Cause.Cause<unknown>>,
): ErrorAttributes & { readonly "error.tag"?: string } => {
  const squashed = Cause.squash(cause);
  const attributes = errorAttributes(squashed);
  const failureTag = isRecord(squashed) ? squashed._tag : undefined;
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
  return Effect.logError("application.error", failureAttributes(cause));
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
  yield* served.responseStatus >= httpStatus.internalServerError
    ? Effect.logError("http.server.request", attributes)
    : Effect.logInfo("http.server.request", attributes);
});

export const observeRequest = <Requirements>(
  incoming: Request,
  handle: (incoming: Request) => Effect.Effect<Response, never, Requirements | CurrentRequest>,
): Effect.Effect<Response, never, Telemetry | Exclude<Requirements, CurrentRequest>> => {
  return Effect.gen(function* observe() {
    const entropy = yield* RequestEntropy;
    const requestContext = incomingContext({ entropy, headers: incoming.headers });
    return yield* Effect.gen(function* respond() {
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
  });
};
