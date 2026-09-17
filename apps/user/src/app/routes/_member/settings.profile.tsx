import { ProfileEditRoute } from "./-profile-edit-route.tsx";
import { createFileRoute } from "@tanstack/react-router";
import { loadProfile } from "#pages/profile-edit/index.ts";

const Route = createFileRoute("/_member/settings/profile")({
  component: ProfileEditRoute,
  loader: loadProfile,
});

export { Route };
