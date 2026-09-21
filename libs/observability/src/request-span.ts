import { Cause, Clock, Context, Effect, Fiber, Predicate, Tracer } from "effect";

import { annotateLogs, annotateSpan, withSpan } from "./annotations.ts";
import { CurrentRequest, type RequestContext } from "./current-request.ts";
import {
  errorAttributes,
  errorFingerprint,
  fingerprintIdentity,
  identifierPattern,
  type ErrorAttributes,
} from "./errors.ts";
import { httpStatus } from "./http-status.ts";
import { httpMethod, parentContext, routeLabel, traceparentOf } from "./protocol.ts";
import { logAt, statusSeverity } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";

type Entropy = {
  readonly requestId: () => string;
  readonly epochMilliseconds: () => number;
  readonly monotonicMilliseconds: () => number;
};

const nanosPerMillisecond = 1_000_000n;

const activeClock = (): Clock.Clock => {
  const fiber = Fiber.getCurrent();
  if (fiber === undefined) {
    throw new Error("time was read outside an Effect fiber");
  }
  return fiber.getRef(Clock.Clock);
};

export const RequestEntropy = Context.Reference<Entropy>("@repo/observability/RequestEntropy", {
  defaultValue: (): Entropy => ({
    epochMilliseconds: (): number => activeClock().currentTimeMillisUnsafe(),
    monotonicMilliseconds: (): number =>
      Number(activeClock().monotonicTimeNanosUnsafe() / nanosPerMillisecond),
    requestId: (): string => crypto.randomUUID(),
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
    traceparent: traceparentOf(span),
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
        ([headerName]) =>
          headerName !== "x-request-id" &&
          headerName !== "traceparent" &&
          headerName !== "set-cookie",
      ),
      ...handled.headers.getSetCookie().map((cookie): [string, string] => ["set-cookie", cookie]),
      ["x-request-id", requestContext.requestId],
      ["traceparent", requestContext.traceparent],
    ]),
    status: handled.status,
    statusText: handled.statusText,
  });
};

export const failureAttributesOf = (
  failed: unknown,
): ErrorAttributes & { readonly "error.tag"?: string } => {
  const attributes = errorAttributes(failed);
  const failureTag = Predicate.isObject(failed) ? failed["_tag"] : undefined;
  if (typeof failureTag !== "string" || !identifierPattern.test(failureTag)) {
    return attributes;
  }
  const fingerprint = errorFingerprint(
    fingerprintIdentity(failed),
    `${failureTag}\n${attributes["error.locations"]}`,
  );
  return { ...attributes, "error.fingerprint": fingerprint, "error.tag": failureTag };
};

export const reportFailure = (cause: Readonly<Cause.Cause<unknown>>): Effect.Effect<void> => {
  const attributes = failureAttributesOf(Cause.squash(cause));
  return logAt("Error", {
    attributes: {
      "error.fingerprint": attributes["error.fingerprint"],
      "error.locations": attributes["error.locations"],
      ...(typeof attributes["error.type"] === "string"
        ? { "error.type": attributes["error.type"] }
        : {}),
      ...(typeof attributes["error.tag"] === "string"
        ? { "error.tag": attributes["error.tag"] }
        : {}),
    },
    eventName: "application.error",
  });
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

const recordRequest = (served: {
  readonly incoming: Readonly<Pick<Request, "method" | "url">>;
  readonly responseStatus: number;
  readonly startedAt: number;
}): Effect.Effect<void, never, Telemetry> =>
  Effect.gen(function* recordRequestProgram() {
    const telemetry = yield* Telemetry;
    const entropy = yield* RequestEntropy;
    const attributes = {
      duration_ms: entropy.monotonicMilliseconds() - served.startedAt,
      method: httpMethod(served.incoming.method),
      route: routeLabel(new URL(served.incoming.url).pathname, telemetry.routes),
      status: served.responseStatus,
    };
    yield* annotateSpan(attributes);
    yield* logAt(statusSeverity(served.responseStatus), {
      attributes,
      eventName: "http.server.request",
    });
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
    annotateLogs({
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
    withSpan("http.server.request", {
      kind: "server",
      parent: incomingParent(incoming.headers),
    }),
  );
};
