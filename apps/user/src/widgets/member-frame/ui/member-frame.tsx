import type { ReactElement, ReactNode, ReactPortal } from "react";

import type { Session } from "#entities/session/index.ts";
import { ToastProvider } from "@template/ui";

import { MemberHeader } from "./member-header.tsx";

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
