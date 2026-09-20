import { createFileRoute } from "@tanstack/react-router";

import { profileOptions } from "#entities/profile/index.ts";
import { ProfileEditRoute } from "./-profile-edit-route.tsx";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_member/settings/profile")({
  component: ProfileEditRoute,
  loader: async ({ context }: Readonly<{ context: Readonly<{ queryClient: QueryClient }> }>) =>
    context.queryClient.ensureQueryData(profileOptions),
});

export { Route };
