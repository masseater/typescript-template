import { useLocation } from "@tanstack/react-router";

import { titleForPath } from "../model/navigation.ts";
import { AccountMenu } from "./account-menu.tsx";

import type { Session } from "#entities/session/index.ts";
import type { ReactElement } from "react";

function MemberTopBar({ user }: Readonly<{ user: Session["user"] }>): ReactElement {
  const { pathname } = useLocation();
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2 md:hidden">
      <AccountMenu name={user.name} userId={user.id} compact />
      <p className="min-w-0 flex-1 truncate text-center text-base leading-tight font-bold">
        {titleForPath(pathname)}
      </p>
      <span className="w-9" aria-hidden="true" />
    </header>
  );
}

export { MemberTopBar };
