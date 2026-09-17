import { ProfilePage } from "#pages/profile/index.ts";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_member/users/$id");

function ProfileRoute(): ReactElement {
  const member = route.useLoaderData();
  const { session } = route.useRouteContext();
  return <ProfilePage member={member} own={member.id === session.user.id} />;
}

export { ProfileRoute };
