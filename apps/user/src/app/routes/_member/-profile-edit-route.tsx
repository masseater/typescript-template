import { ProfileEditPage } from "#pages/profile-edit/index.ts";
import type { ReactElement } from "react";
import { getRouteApi } from "@tanstack/react-router";

const route = getRouteApi("/_member/settings/profile");

function ProfileEditRoute(): ReactElement {
  return <ProfileEditPage initial={route.useLoaderData()} />;
}

export { ProfileEditRoute };
