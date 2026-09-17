import { AccountMenu } from "./account-menu.tsx";
import { MemberNavigation } from "./member-navigation.tsx";
import { ProfileLink } from "#shared/ui/index.ts";
import type { ReactElement } from "react";
import type { Session } from "#entities/session/index.ts";
import { serviceName } from "#shared/config/index.ts";

function MemberHeader({ user }: Readonly<{ user: Session["user"] }>): ReactElement {
  return (
    <header className="flex w-full items-center gap-4 border-b border-border bg-card px-4 py-3 shadow-sm">
      <ProfileLink
        id={user.id}
        className="text-lg leading-tight font-bold text-foreground no-underline"
      >
        {serviceName}
      </ProfileLink>
      <MemberNavigation userId={user.id} />
      <div className="ml-auto">
        <AccountMenu name={user.name} />
      </div>
    </header>
  );
}

export { MemberHeader };
