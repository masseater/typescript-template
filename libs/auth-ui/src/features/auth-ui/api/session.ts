import { httpStatus } from "@repo/config";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";

import { browserGet } from "../browser-http.ts";
import { SessionView, decodeJson, type SessionView as SessionData } from "../protocol.ts";

const requestSession = (endpoint: string): Effect.Effect<SessionData | undefined> =>
  Effect.gen(function* readSession() {
    const served = yield* browserGet(endpoint, { cache: "no-store", credentials: "same-origin" });
    if (served.status === httpStatus.unauthorized) {
      return undefined;
    }
    if (served.status < 200 || served.status >= 300) {
      return yield* Effect.die(
        new Error(`セッションの取得に失敗しました（HTTP ${served.status}）。`),
      );
    }
    return decodeJson(SessionView, yield* served.json.pipe(Effect.orDie));
  });

type SessionLoader = () => Promise<SessionData | undefined>;

const sessionEndpoint = "/api/session";

const loadBrowserSession: SessionLoader = (): Promise<SessionData | undefined> =>
  Effect.runPromise(requestSession(sessionEndpoint));

const sessionKey = ["auth", "session"] as const;

const sessionOptions = queryOptions<
  SessionData | undefined,
  Error,
  SessionData | undefined,
  typeof sessionKey
>({ queryKey: sessionKey, retry: false });

const provideSessionLoader = (queries: QueryClient, load: SessionLoader): void => {
  queries.setQueryDefaults(sessionKey, { queryFn: load, retry: false });
};

export { loadBrowserSession, provideSessionLoader, sessionOptions };
