import { Effect, Ref, Schema } from "effect";

import type { Page, Response } from "playwright";

const SessionBody = Schema.Struct({
  user: Schema.optionalKey(
    Schema.Struct({
      id: Schema.optionalKey(Schema.String),
    }),
  ),
});

const decodeSessionBody = Schema.decodeUnknownPromise(SessionBody);

const requestIdHeader = "x-request-id";
const traceparentHeader = "traceparent";

const traceIdFromTraceparent = (traceparent: string): string | undefined => {
  const [version, traceId] = traceparent.split("-");
  if (version !== "00" || traceId?.length !== 32) {
    return undefined;
  }
  return traceId;
};

const attachObservabilityCapture = (
  page: Page,
): {
  readonly requestIds: readonly string[];
  readonly sessionToken: string | undefined;
  readonly traceIds: readonly string[];
  readonly userId: string | undefined;
  readonly stop: () => void;
} => {
  const requestIds = Ref.makeUnsafe<readonly string[]>([]);
  const traceIds = Ref.makeUnsafe<readonly string[]>([]);
  const onResponse = (httpExchange: Response): void => {
    const requestId = httpExchange.headers()[requestIdHeader];
    if (requestId !== undefined && requestId !== "") {
      Effect.runSync(Ref.set(requestIds, [...Ref.getUnsafe(requestIds), requestId]));
    }
    const traceparent = httpExchange.headers()[traceparentHeader];
    if (traceparent !== undefined) {
      const traceId = traceIdFromTraceparent(traceparent);
      if (traceId !== undefined) {
        Effect.runSync(Ref.set(traceIds, [...Ref.getUnsafe(traceIds), traceId]));
      }
    }
  };
  page.on("response", onResponse);
  return {
    get requestIds(): readonly string[] {
      return Ref.getUnsafe(requestIds);
    },
    get sessionToken(): string | undefined {
      return undefined;
    },
    get traceIds(): readonly string[] {
      return Ref.getUnsafe(traceIds);
    },
    get userId(): string | undefined {
      return undefined;
    },
    stop: (): void => {
      page.off("response", onResponse);
    },
  };
};

const readSession = (
  page: Page,
  sessionUrl: string,
): Effect.Effect<{
  readonly sessionToken: string | undefined;
  readonly userId: string | undefined;
}> =>
  Effect.gen(function* loadSession() {
    const sessionHttpReply = yield* Effect.promise(() => page.request.get(sessionUrl));
    if (!sessionHttpReply.ok()) {
      return { sessionToken: undefined, userId: undefined };
    }
    const sessionRaw: unknown = yield* Effect.tryPromise(() => sessionHttpReply.json()).pipe(
      Effect.orDie,
    );
    const sessionJson = yield* Effect.tryPromise(() => decodeSessionBody(sessionRaw)).pipe(
      Effect.orDie,
    );
    const sessionOrigin = new URL(sessionUrl).origin;
    const cookies = yield* Effect.promise(() => page.context().cookies(sessionOrigin));
    const sessionCookie = cookies.find((cookie) => cookie.name.endsWith(".session_token"));
    return {
      sessionToken: sessionCookie?.value,
      userId: sessionJson.user?.id,
    };
  });

export { attachObservabilityCapture, readSession };
