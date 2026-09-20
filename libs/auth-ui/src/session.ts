import { httpStatus } from "@repo/observability/http-status";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";

import { SessionView, decodeJson, type SessionView as SessionData } from "./protocol.ts";

type SessionLoader = () => Promise<SessionData | undefined>;

const sessionEndpoint = "/api/session";

const sessionKey = ["auth", "session"] as const;

class SessionFetchFailed extends Schema.TaggedError<SessionFetchFailed>()("SessionFetchFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.String,
}) {}

const requestSession = (
  endpoint: string,
): Effect.Effect<SessionData | undefined, SessionFetchFailed> =>
  Effect.gen(function* requestSession() {
    const served = yield* Effect.tryPromise({
      try: async (): Promise<Response> =>
        fetch(endpoint, { cache: "no-store", credentials: "same-origin" }),
      catch: (cause) =>
        new SessionFetchFailed({
          cause,
          reason: "セッションの取得に失敗しました。もう一度お試しください。",
        }),
    });
    if (served.status === httpStatus.unauthorized) {
      return undefined;
    }
    if (!served.ok) {
      return yield* Effect.fail(
        new SessionFetchFailed({
          reason: `セッションの取得に失敗しました（HTTP ${served.status}）。`,
        }),
      );
    }
    const servedSession: unknown = yield* Effect.tryPromise({
      try: async (): Promise<unknown> => served.json(),
      catch: (cause) =>
        new SessionFetchFailed({
          cause,
          reason: "セッションの取得に失敗しました。もう一度お試しください。",
        }),
    });
    return decodeJson(SessionView, servedSession);
  });

const loadBrowserSession: SessionLoader = async (): Promise<SessionData | undefined> => {
  const matched = await Effect.runPromise(
    Effect.match(requestSession(sessionEndpoint), {
      onFailure: (failure) => ({ reason: failure.reason }),
      onSuccess: (session) => ({ session }),
    }),
  );
  return "reason" in matched ? Promise.reject(new Error(matched.reason)) : matched.session;
};

const sessionOptions = queryOptions<
  SessionData | undefined,
  Error,
  SessionData | undefined,
  typeof sessionKey
>({ queryKey: sessionKey, retry: false });

const provideSessionLoader = (queries: QueryClient, load: SessionLoader): void => {
  queries.setQueryDefaults(sessionKey, { queryFn: load, retry: false });
};

export { loadBrowserSession, provideSessionLoader, sessionKey, sessionOptions };
export type { SessionLoader };
