import { getRouteApi } from "@tanstack/react-router";

import { ProfileEditPage } from "#pages/profile-edit/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/profile");

const ProfileEditRoute = (): ReactElement => {
  return <ProfileEditPage initial={route.useLoaderData()} />;
};

export { ProfileEditRoute };
