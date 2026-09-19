import { ToastProvider } from "@repo/ui";

import { MemberHeader } from "./member-header.tsx";

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
      <MemberHeader user={user} />
      {children}
    </ToastProvider>
  );
}

export { MemberFrame };
