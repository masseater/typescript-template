import { createFileRoute } from "@tanstack/react-router";

import { visibilityOptions } from "#entities/profile/index.ts";
import { VisibilityRoute } from "#pages/settings/index.ts";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_member/settings/visibility")({
  component: VisibilityRoute,
  gcTime: 0,
  loader: ({ context }: Readonly<{ context: Readonly<{ queryClient: QueryClient }> }>) =>
    context.queryClient.ensureQueryData(visibilityOptions),
});

export { Route };
