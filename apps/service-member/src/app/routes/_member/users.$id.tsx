import { createFileRoute } from "@tanstack/react-router";

import {
  ProfileFailed,
  ProfileMissing,
  ProfilePending,
  memberOptions,
} from "#pages/profile/index.ts";
import { ProfileRoute } from "./-profile-route.tsx";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  loader: async ({
    context,
    params,
  }: Readonly<{
    context: Readonly<{ queryClient: QueryClient }>;
    params: Readonly<{ id: string }>;
  }>) => context.queryClient.ensureQueryData(memberOptions(params.id)),
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
