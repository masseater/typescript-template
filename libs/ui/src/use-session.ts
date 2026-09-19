import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { SessionView as SessionContract } from "@repo/runtime/contracts";
import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";

import { errorMessage, type SessionView } from "./protocol.ts";

type SessionSnapshot = {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionView | undefined;
};

const sessionEndpoint = "/api/session";

const fetchSession = async (endpoint: string): Promise<SessionView | undefined> => {
  const served = await fetch(endpoint, { cache: "no-store", credentials: "same-origin" });
  if (served.status === httpStatus.unauthorized) {
    return undefined;
  }
  if (!served.ok) {
    throw new Error(`セッションの取得に失敗しました（HTTP ${served.status}）。`);
  }
  const servedSession: unknown = await served.json();
  return decodeJson(SessionContract, servedSession);
};

const loadSession = async (): Promise<SessionSnapshot> => {
  try {
    return { error: undefined, loading: false, session: await fetchSession(sessionEndpoint) };
  } catch (failure) {
    return { error: errorMessage(failure), loading: false, session: undefined };
  }
};

const useSession = (): SessionSnapshot & { readonly refresh: () => Promise<void> } => {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    error: undefined,
    loading: true,
    session: undefined,
  });
  const refresh = async (): Promise<void> => {
    setSnapshot(await loadSession());
  };
  useEffect(() => {
    const loading = Effect.runFork(
      Effect.map(Effect.promise(loadSession), (loaded) => {
        setSnapshot(loaded);
      }),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, []);
  return { ...snapshot, refresh };
};

export { useSession };
