import { ToastProvider } from "@repo/ui";

import { MemberRail } from "./member-rail.tsx";
import { MemberTabs } from "./member-tabs.tsx";
import { MemberTopBar } from "./member-top-bar.tsx";

import type { Session } from "#entities/session/index.ts";
import type { ReactElement, ReactNode, ReactPortal } from "react";

function MemberFrame({
  children,
  user,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  user: Session["user"];
}>): ReactElement {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-background">
        <MemberRail user={user} />
        <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
          <MemberTopBar user={user} />
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
        <MemberTabs />
      </div>
    </ToastProvider>
  );
}

export { MemberFrame };
