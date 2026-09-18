import { decodeJson } from "@template/runtime/client";
import { SessionView as SessionContract } from "@template/runtime/contracts";
import { useEffect, useState } from "react";

import { errorMessage } from "./protocol";

import type { SessionView } from "./protocol";

type SessionSnapshot = {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionView | undefined;
};

type SessionState = {
  readonly refresh: () => Promise<void>;
} & SessionSnapshot;

const HTTP_UNAUTHORIZED = 401;

const fetchSession = async (): Promise<SessionView | undefined> => {
  const response = await fetch("/api/session", { cache: "no-store", credentials: "same-origin" });
  if (response.status === HTTP_UNAUTHORIZED) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`セッションの取得に失敗しました（HTTP ${response.status}）。`);
  }
  const body: unknown = await response.json();
  return decodeJson(SessionContract, body);
};

const loadSession = async (): Promise<SessionSnapshot> => {
  try {
    return { error: undefined, loading: false, session: await fetchSession() };
  } catch (error) {
    return { error: errorMessage(error), loading: false, session: undefined };
  }
};

const useSession = (): SessionState => {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    error: undefined,
    loading: true,
    session: undefined,
  });
  const refresh = async (): Promise<void> => {
    setSnapshot(await loadSession());
  };
  useEffect(() => {
    const load = async (): Promise<void> => {
      setSnapshot(await loadSession());
    };
    void load();
  }, []);
  return { ...snapshot, refresh };
};

export { useSession };
