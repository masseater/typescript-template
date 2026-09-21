import { createFileRoute } from "@tanstack/react-router";

import { ProfileFailed, ProfileMissing, ProfilePending, loadMember } from "#pages/profile/index.ts";
import { ProfileRoute } from "./-profile-route.tsx";

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  loader: ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) => loadMember(params.id),
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
