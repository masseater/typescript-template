import { Outlet, getRouteApi } from "@tanstack/react-router";

import { MemberFrame } from "./member-frame.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member");

function MemberLayout(): ReactElement {
  const { memberBoard, session } = route.useRouteContext();
  const navBadges = route.useLoaderData();
  return (
    <MemberFrame memberBoard={memberBoard} navBadges={navBadges} user={session.user}>
      <Outlet />
    </MemberFrame>
  );
}

export { MemberLayout };
