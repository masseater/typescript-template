import { Outlet, getRouteApi } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { MemberFrame } from "#widgets/member-frame/index.ts";

const route = getRouteApi("/_member");

function MemberLayout(): ReactElement {
  const { session } = route.useRouteContext();
  return (
    <MemberFrame user={session.user}>
      <Outlet />
    </MemberFrame>
  );
}

export { MemberLayout };
