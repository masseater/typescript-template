import { SessionUserContext, type SessionUser } from "./session-user.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

const SessionUserProvider = ({
  children,
  user,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  user: SessionUser;
}>): ReactElement => <SessionUserContext value={user}>{children}</SessionUserContext>;

export { SessionUserProvider };
