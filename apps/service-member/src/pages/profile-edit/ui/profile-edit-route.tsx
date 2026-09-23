import { getRouteApi } from "@tanstack/react-router";

import { ProfileEditPage } from "./profile-edit-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/profile");

function ProfileEditRoute(): ReactElement {
  return <ProfileEditPage initial={route.useLoaderData()} />;
}

export { ProfileEditRoute };
