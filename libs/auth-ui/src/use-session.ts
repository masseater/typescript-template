import { useAtomValue } from "@effect/atom-react";
import { httpStatus } from "@repo/observability/http-status";
import { requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { SessionView, decodeJson, type SessionView as SessionData } from "./protocol.ts";

const sessionEndpoint = "/api/session";

const fetchSession = async (endpoint: string): Promise<SessionData | undefined> => {
  const served = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
  if (served.status === httpStatus.unauthorized) {
    return undefined;
  }
  if (!served.ok) {
    throw new Error(`セッションの取得に失敗しました（HTTP ${served.status}）。`);
  }
  const sessionJson: unknown = await served.json();
  return decodeJson(SessionView, sessionJson);
};

const sessionAtom = requestAtom(async () => fetchSession(sessionEndpoint));

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
