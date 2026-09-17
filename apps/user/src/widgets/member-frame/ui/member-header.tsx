import { AccountMenu } from "./account-menu.tsx";
import { MemberNavigation } from "./member-navigation.tsx";
import { NavigationLink } from "@template/ui/ui";
import type { ReactElement } from "react";
import type { Session } from "#entities/session/index.ts";
import { serviceName } from "#shared/config/index.ts";

function MemberHeader({ user }: Readonly<{ user: Session["user"] }>): ReactElement {
  return (
    <header className="flex w-full items-center gap-4 border-b border-border bg-card px-4 py-3 shadow-sm">
      <NavigationLink to="/users/$id" params={{ id: user.id }} variant="brand">
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
