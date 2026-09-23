import { Outlet, getRouteApi } from "@tanstack/react-router";

import { MemberFrame } from "./member-frame.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member");

function MemberLayout(): ReactElement {
  const { memberBoard, session } = route.useRouteContext();
  return (
    <MemberFrame memberBoard={memberBoard} user={session.user}>
      <Outlet />
    </MemberFrame>
  );
}

export { MemberLayout };
