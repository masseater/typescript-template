import { ToastProvider } from "@repo/ui";

import { MemberRail } from "./member-rail.tsx";
import { MemberTabs } from "./member-tabs.tsx";
import { MemberTopBar } from "./member-top-bar.tsx";

import type { Session } from "#entities/session/index.ts";
import type { ReactElement, ReactNode, ReactPortal } from "react";
import type { NavBadges } from "../model/navigation.ts";

function MemberFrame({
  children,
  memberBoard,
  navBadges,
  user,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  memberBoard: boolean;
  navBadges: NavBadges;
  user: Session["user"];
}>): ReactElement {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-background">
        <MemberRail memberBoard={memberBoard} navBadges={navBadges} user={user} />
        <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
          <MemberTopBar user={user} />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
        <MemberTabs memberBoard={memberBoard} navBadges={navBadges} profileId={user.id} />
      </div>
    </ToastProvider>
  );
}

export { MemberFrame };
