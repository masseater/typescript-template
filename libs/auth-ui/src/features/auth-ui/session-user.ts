import { Schema } from "effect";
import { createContext, useContext } from "react";

import type { SessionView } from "./protocol.ts";

type SessionUser = SessionView["user"];

const SessionUserContext = createContext<SessionUser | undefined>(undefined);

class SessionUserMissing extends Schema.TaggedError<SessionUserMissing>()(
  "SessionUserMissing",
  {},
) {}

const useSessionUser = (): SessionUser => {
  const sessionUser = useContext(SessionUserContext);
  if (sessionUser === undefined) {
    throw new SessionUserMissing();
  }
  return sessionUser;
};

export { SessionUserContext, useSessionUser };
export type { SessionUser };
