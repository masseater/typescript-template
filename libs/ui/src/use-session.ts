import { requestAtom, resultError } from "./request";
import { AsyncResult } from "effect/unstable/reactivity";
import { SessionView as SessionContract } from "@template/runtime/contracts";
import type { SessionView } from "./protocol";
import { decodeJson } from "@template/runtime/client";
import { useAtomValue } from "@effect/atom-react";

interface SessionState {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionView | undefined;
}

const HTTP_UNAUTHORIZED = 401;

async function fetchSession(): Promise<SessionView | undefined> {
  const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
  if (response.status === HTTP_UNAUTHORIZED) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`セッションの取得に失敗しました（HTTP ${response.status}）。`);
  }
  const body: unknown = await response.json();
  return decodeJson(SessionContract, body);
}

const sessionAtom = requestAtom(fetchSession);

function useSession(): SessionState {
  const result = useAtomValue(sessionAtom);
  return {
    error: resultError(result),
    loading: AsyncResult.isInitial(result),
    session: AsyncResult.isSuccess(result) ? result.value : undefined,
  };
}

export { useSession };
