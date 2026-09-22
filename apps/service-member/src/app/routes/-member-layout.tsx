import { Outlet, getRouteApi } from "@tanstack/react-router";

import { MemberFrame } from "#widgets/member-frame/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member");

function MemberLayout(): ReactElement {
  const { memberBoard, session } = route.useRouteContext();
  route.useLoaderData();
  return (
    <MemberFrame memberBoard={memberBoard} user={session.user}>
      <Outlet />
    </MemberFrame>
  );
}

export { MemberLayout };
