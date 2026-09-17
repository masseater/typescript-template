import { AccountMenu } from "./account-menu.tsx";
import { MemberNavigation } from "./member-navigation.tsx";
import { NavigationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import type { Session } from "#entities/session/index.ts";
import { serviceName } from "#shared/config/index.ts";
import { useMemo } from "react";

function MemberHeader({ user }: Readonly<{ user: Session["user"] }>): ReactElement {
  const home = useMemo(() => ({ id: user.id }), [user.id]);
  return (
    <header className="flex w-full items-center gap-4 border-b border-border bg-card px-4 py-3 shadow-sm">
      <NavigationLink to="/users/$id" params={home} variant="brand">
        {serviceName}
      </NavigationLink>
      <MemberNavigation userId={user.id} />
      <div className="ml-auto">
        <AccountMenu name={user.name} />
      </div>
    </header>
  );
}

export { MemberHeader };
