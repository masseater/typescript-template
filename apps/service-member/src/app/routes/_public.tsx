import { createFileRoute } from "@tanstack/react-router";

import { enterPublicFrame } from "#app/entry-conditions.ts";
import { PublicFrame } from "#widgets/public-frame/index.ts";

import type { QueryClient } from "@tanstack/react-query";

const Route = createFileRoute("/_public")({
  beforeLoad: ({
    context,
    location,
  }: Readonly<{
    context: Readonly<{ queryClient: QueryClient }>;
    location: Readonly<{ pathname: string }>;
  }>) => enterPublicFrame(context.queryClient, location.pathname),
  component: PublicFrame,
});

export { Route };
