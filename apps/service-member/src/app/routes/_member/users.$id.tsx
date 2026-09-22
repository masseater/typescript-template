import { createFileRoute } from "@tanstack/react-router";

import { ProfileFailed, ProfileMissing, ProfilePending, ProfileRoute, loadMember } from "#pages/profile/index.ts";

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  loader: ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) => loadMember(params.id),
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
