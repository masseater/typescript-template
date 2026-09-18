import { serverQuery, useServerQuery } from "./server-query";
import { Option } from "effect";
import { SessionView as SessionContract } from "@template/runtime/contracts";
import type { SessionView } from "./protocol";
import { decodeJson } from "@template/runtime/client";
import { request } from "./request";

interface SessionState {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionView | undefined;
}

const HTTP_UNAUTHORIZED = 401;

async function fetchSession(): Promise<Option.Option<SessionView>> {
  const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
  if (response.status === HTTP_UNAUTHORIZED) {
    return Option.none();
  }
  if (!response.ok) {
    throw new Error(`セッションの取得に失敗しました（HTTP ${response.status}）。`);
  }
  const body: unknown = await response.json();
  return Option.some(decodeJson(SessionContract, body));
}

const sessionQuery = serverQuery(["session"], request(fetchSession));

function useSession(): SessionState {
  const result = useServerQuery(sessionQuery);
  return {
    error: result.status === "failure" ? result.message : undefined,
    loading: result.status === "pending",
    session: result.status === "success" ? Option.getOrUndefined(result.value) : undefined,
  };
}

export { useSession };
