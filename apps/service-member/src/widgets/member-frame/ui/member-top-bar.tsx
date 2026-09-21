import { useLocation } from "@tanstack/react-router";

import { serviceName } from "#shared/config/index.ts";
import { titleForPath } from "../model/navigation.ts";
import { AccountMenu } from "./account-menu.tsx";

import type { ReactElement } from "react";

function MemberTopBar({
  user,
}: Readonly<{ user: Readonly<{ id: string; name: string }> }>): ReactElement {
  const { pathname } = useLocation();
  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2 md:hidden">
      <AccountMenu name={user.name} userId={user.id} compact />
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm leading-tight font-bold">{serviceName}</p>
        <p className="truncate text-base leading-tight font-bold">{titleForPath(pathname)}</p>
      </div>
      <span className="w-9" aria-hidden="true" />
    </header>
  );
}

export { MemberTopBar };
