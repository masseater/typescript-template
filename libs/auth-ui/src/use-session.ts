import { httpStatus } from "@repo/observability/http-status";
import { Effect, Fiber, Schema } from "effect";
import { useEffect, useState } from "react";

import { SessionView, decodeJson, type SessionView as SessionData } from "./protocol.ts";

type SessionSnapshot = {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionData | undefined;
};

const sessionEndpoint = "/api/session";

class SessionFetchFailed extends Schema.TaggedError<SessionFetchFailed>()("SessionFetchFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.String,
}) {}

const fetchSession = (
  endpoint: string,
): Effect.Effect<SessionData | undefined, SessionFetchFailed> =>
  Effect.gen(function* fetchSession() {
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

const loadSession = (): Effect.Effect<SessionSnapshot> =>
  fetchSession(sessionEndpoint).pipe(
    Effect.match({
      onFailure: (failure) => ({
        error: failure.reason,
        loading: false,
        session: undefined,
      }),
      onSuccess: (session) => ({ error: undefined, loading: false, session }),
    }),
  );

const useSession = (): SessionSnapshot & { readonly refresh: () => Promise<void> } => {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    error: undefined,
    loading: true,
    session: undefined,
  });
  const refresh = async (): Promise<void> => {
    setSnapshot(await Effect.runPromise(loadSession()));
  };
  useEffect(() => {
    const loading = Effect.runFork(
      Effect.map(loadSession(), (loaded) => {
        setSnapshot(loaded);
      }),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, []);
  return { ...snapshot, refresh };
};

export { useSession };
