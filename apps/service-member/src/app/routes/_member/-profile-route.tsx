import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { ProfilePage, memberOptions } from "#pages/profile/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/$id");

function ProfileRoute(): ReactElement {
  const { id } = route.useParams();
  const member = useSuspenseQuery(memberOptions(id));
  const { session } = route.useRouteContext();
  return <ProfilePage member={member.data} own={member.data.id === session.user.id} />;
}

export { ProfileRoute };
