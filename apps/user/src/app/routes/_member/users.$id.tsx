import { ProfileFailed, ProfileMissing, ProfilePending, loadMember } from "#pages/profile/index.ts";
import { ProfileRoute } from "./-profile-route.tsx";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  loader: async ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) =>
    loadMember(params.id),
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
