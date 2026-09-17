import { useCallback, useEffect, useState } from "react";
import { SessionView as SessionContract } from "@template/runtime/contracts";
import { Schema } from "effect";
import { errorMessage } from "./protocol";
import type { SessionView } from "./protocol";

export function useSession() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    return fetch("/api/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok)
          throw new Error(`セッションの取得に失敗しました（HTTP ${response.status}）。`);
        const body: unknown = await response.json();
        return Schema.decodeUnknownSync(SessionContract)(body);
      })
      .then((value) => {
        setSession(value);
        setError(null);
        return undefined;
      })
      .catch((cause: unknown) => {
        setSession(null);
        setError(errorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { session, loading, error, refresh };
}
