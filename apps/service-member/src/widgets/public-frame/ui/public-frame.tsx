import { Outlet } from "@tanstack/react-router";

import { PublicFooter } from "./public-footer.tsx";
import { PublicHeader } from "./public-header.tsx";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function PublicFrame({
  children,
}: Readonly<{ children?: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <>
      <PublicHeader />
      {children ?? <Outlet />}
      <PublicFooter />
    </>
  );
}

export { PublicFrame };
