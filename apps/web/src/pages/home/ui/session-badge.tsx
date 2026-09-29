import type { ReactNode } from "react";

import { authClient } from "#/shared/auth";

const GUEST = "Guest";

const SessionBadge = (): ReactNode => {
  const session = authClient.useSession();
  if (session.data === null) {
    return <span className="text-muted-foreground text-sm">{GUEST}</span>;
  }
  return <span className="text-sm">{session.data.user.name}</span>;
};

export { SessionBadge };
