import { getRouteApi } from "@tanstack/react-router";

import { ProfilePage } from "./profile-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/$id");

function ProfileRoute(): ReactElement {
  const member = route.useLoaderData();
  const { session } = route.useRouteContext();
  return <ProfilePage member={member} own={member.id === session.user.id} />;
}

export { ProfileRoute };
