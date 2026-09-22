import { Outlet, createFileRoute } from "@tanstack/react-router";

import { enterPublicFrame } from "#app/entry-conditions.ts";
import { PublicFrame } from "#widgets/public-frame/index.ts";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";

const Route = createFileRoute("/_public")({
  beforeLoad: ({
    context,
    location,
  }: Readonly<{
    context: Readonly<{ queryClient: QueryClient }>;
    location: Readonly<{ pathname: string }>;
  }>) => enterPublicFrame(context.queryClient, location.pathname),
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
