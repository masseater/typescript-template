import { createFileRoute } from "@tanstack/react-router";

import { loadProfile } from "#pages/profile-edit/index.ts";
import { ProfileEditRoute } from "./-profile-edit-route.tsx";

const Route = createFileRoute("/_member/settings/profile")({
  component: ProfileEditRoute,
  gcTime: 0,
  loader: loadProfile,
});

export { Route };
