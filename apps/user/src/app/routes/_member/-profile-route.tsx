import { ProfilePage } from "#pages/profile/index.ts";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_member/users/$id");

function ProfileRoute(): ReactElement {
  const { id } = route.useParams();
  const { session } = route.useRouteContext();
  return <ProfilePage id={id} own={id === session.user.id} />;
}

export { ProfileRoute };
