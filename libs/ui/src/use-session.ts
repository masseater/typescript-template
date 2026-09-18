import { decodeJson } from "@repo/runtime/client";
import { SessionView as SessionContract } from "@repo/runtime/contracts";
import { useEffect, useState } from "react";

import { errorMessage } from "./protocol";

import type { SessionView } from "./protocol";

interface SessionSnapshot {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionView | undefined;
}

interface SessionState extends SessionSnapshot {
  readonly refresh: () => Promise<void>;
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

async function loadSession(): Promise<SessionSnapshot> {
  try {
    return { error: undefined, loading: false, session: await fetchSession() };
  } catch (error) {
    return { error: errorMessage(error), loading: false, session: undefined };
  }
}

function useSession(): SessionState {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    error: undefined,
    loading: true,
    session: undefined,
  });
  async function refresh(): Promise<void> {
    setSnapshot(await loadSession());
  }
  useEffect(() => {
    async function load(): Promise<void> {
      setSnapshot(await loadSession());
    }
    void load();
  }, []);
  return { ...snapshot, refresh };
}

export { useSession };
