import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { request, resultError } from "./request";
import { Option } from "effect";
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

const sessionAtom = Atom.make(request(fetchSession)).pipe(Atom.withServerValueInitial);

function useSession(): SessionState {
  const result = useAtomValue(sessionAtom);
  return {
    error: resultError(result),
    loading: AsyncResult.isInitial(result),
    session: Option.getOrUndefined(AsyncResult.value(result)),
  };
}

export { useSession };
