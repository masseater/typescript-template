import { ProfileEditRoute } from "./-profile-edit-route.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_member/settings/profile")({
  component: ProfileEditRoute,
});

export { Route };
