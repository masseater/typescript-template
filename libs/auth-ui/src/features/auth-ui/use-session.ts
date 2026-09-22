import { useAtomValue } from "@effect/atom-react";
import { httpStatus } from "@repo/observability/http-status";
import { requestAtom, resultError } from "@repo/ui";
import { Effect } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";

import { browserGet } from "./browser-http.ts";
import { SessionView, decodeJson, type SessionView as SessionData } from "./protocol.ts";

const sessionEndpoint = "/api/session";

const fetchSession = (endpoint: string): Effect.Effect<SessionData | undefined> =>
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

const sessionAtom = requestAtom(() => Effect.runPromise(fetchSession(sessionEndpoint)));

const useSession = (): {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionData | undefined;
} => {
  const snapshot = useAtomValue(sessionAtom);
  return {
    error: resultError(snapshot),
    loading: AsyncResult.isInitial(snapshot),
    session: AsyncResult.isSuccess(snapshot) ? snapshot.value : undefined,
  };
};

export { useSession };
