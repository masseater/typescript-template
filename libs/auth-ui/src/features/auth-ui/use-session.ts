import { useQuery } from "@tanstack/react-query";

import { sessionOptions } from "./api/session.ts";

import type { SessionView as SessionData } from "./protocol.ts";

const useSession = (): {
  readonly error: string | undefined;
  readonly loading: boolean;
  readonly session: SessionData | undefined;
} => {
  const session = useQuery(sessionOptions);
  return {
    error: session.error?.message,
    loading: session.isPending,
    session: session.data,
  };
};

export { useSession };
