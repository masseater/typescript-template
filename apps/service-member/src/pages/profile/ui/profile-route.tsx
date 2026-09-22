import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { memberOptions } from "../api/load-member.ts";
import { ProfilePage } from "./profile-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/users/$id");

function ProfileRoute(): ReactElement {
  const { id } = route.useParams();
  const member = useSuspenseQuery(memberOptions(id));
  const { session } = route.useRouteContext();
  return <ProfilePage member={member.data} own={member.data.id === session.user.id} />;
}

export { ProfileRoute };
