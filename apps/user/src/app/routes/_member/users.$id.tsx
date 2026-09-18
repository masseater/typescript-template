import {
  ProfileFailed,
  ProfileMissing,
  ProfilePending,
  memberOptions,
} from "#pages/profile/index.ts";
import { ProfileRoute } from "./-profile-route.tsx";
import type { RouterContext } from "#app/router-context.ts";
import { createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  loader: async ({
    context,
    params,
  }: Readonly<{ context: RouterContext; params: Readonly<{ id: string }> }>): Promise<void> => {
    await context.queryClient.query(memberOptions(params.id));
  },
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
