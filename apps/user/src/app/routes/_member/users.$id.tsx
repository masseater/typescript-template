import {
  ProfileFailed,
  ProfileMissing,
  ProfilePending,
  memberOptions,
} from "#pages/profile/index.ts";
import { ProfileRoute } from "./-profile-route.tsx";
import type { RouterContext } from "#app/router-context.ts";
import { createFileRoute } from "@tanstack/react-router";

interface MemberLoad {
  readonly context: RouterContext;
  readonly params: Readonly<{ id: string }>;
}

const Route = createFileRoute("/_member/users/$id")({
  component: ProfileRoute,
  errorComponent: ProfileFailed,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  loader: async ({ context, params }: MemberLoad): Promise<void> => {
    await context.queryClient.query(memberOptions(params.id));
  },
  notFoundComponent: ProfileMissing,
  pendingComponent: ProfilePending,
});

export { Route };
