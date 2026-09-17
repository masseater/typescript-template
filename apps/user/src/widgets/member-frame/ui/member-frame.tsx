import type { ReactElement, ReactNode, ReactPortal } from "react";
import { MemberHeader } from "./member-header.tsx";
import type { Session } from "#entities/session/index.ts";
import { Toaster } from "@template/ui/ui";

function MemberFrame({
  children,
  user,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
  user: Session["user"];
}>): ReactElement {
  return (
    <Toaster>
      <MemberHeader user={user} />
      {children}
    </Toaster>
  );
}

export { MemberFrame };
