import { createContext, useContext } from "react";

import type { SessionView } from "./protocol.ts";

type SessionUser = SessionView["user"];

const SessionUserContext = createContext<SessionUser | undefined>(undefined);

class SessionUserMissing extends Error {
  override readonly name = "SessionUserMissing";
}

const useSessionUser = (): SessionUser => {
  const sessionUser = useContext(SessionUserContext);
  if (sessionUser === undefined) {
    throw new SessionUserMissing("useSessionUser was rendered outside SessionUserProvider");
  }
  return sessionUser;
};

export { SessionUserContext, useSessionUser };
export type { SessionUser };
