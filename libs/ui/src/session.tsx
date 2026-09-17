import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";
import * as v from "valibot";
import { sessionSchema, errorMessage } from "./protocol";
import type { SessionView } from "./protocol";
import { Status } from "./shared/ui";

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
        return v.parse(sessionSchema, body);
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

export function SessionStatus({ session }: { session: SessionView }): ReactElement {
  return (
    <Status>
      {session.user.email}：{session.strong ? "強認証済み" : "追加認証が未完了です"}
    </Status>
  );
}
