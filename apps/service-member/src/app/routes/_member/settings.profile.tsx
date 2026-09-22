import { createFileRoute } from "@tanstack/react-router";

import { ProfileEditRoute, loadProfile } from "#pages/profile-edit/index.ts";

const Route = createFileRoute("/_member/settings/profile")({
  component: ProfileEditRoute,
  gcTime: 0,
  loader: loadProfile,
});

export { Route };
