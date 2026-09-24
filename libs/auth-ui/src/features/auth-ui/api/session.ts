import { httpStatus } from "@repo/config";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";

import { browserGet } from "../browser-http.ts";
import { SessionView, decodeJson, type SessionView as SessionData } from "../protocol.ts";

const requestSession = (endpoint: string): Effect.Effect<SessionData | null> =>
  Effect.gen(function* readSession() {
    const served = yield* browserGet(endpoint, { cache: "no-store", credentials: "same-origin" });
    if (served.status === httpStatus.unauthorized) {
      return null;
    }
    if (served.status < 200 || served.status >= 300) {
      return yield* Effect.die(
        new Error(`セッションの取得に失敗しました（HTTP ${served.status}）。`),
      );
    }
    return decodeJson(SessionView, yield* served.json.pipe(Effect.orDie));
  });

const sessionEndpoint = "/api/session";

const loadBrowserSession = (): Promise<SessionData | null> =>
  Effect.runPromise(requestSession(sessionEndpoint));

const sessionKey = ["auth", "session"] as const;

const sessionOptions = queryOptions<
  SessionData | null,
  Error,
  SessionData | null,
  typeof sessionKey
>({ queryKey: sessionKey, retry: false });

type SessionLoader = () => Promise<SessionData | null | undefined>;

const provideSessionLoader = (queries: QueryClient, load: SessionLoader): void => {
  queries.setQueryDefaults(sessionKey, {
    queryFn: () =>
      Effect.runPromise(Effect.promise(load).pipe(Effect.map((session) => session ?? null))),
    retry: false,
  });
};

export { loadBrowserSession, provideSessionLoader, sessionOptions };
export type { SessionLoader };
