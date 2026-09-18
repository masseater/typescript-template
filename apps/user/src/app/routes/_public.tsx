import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "#widgets/public-frame/index.ts";
import type { ReactElement } from "react";
import type { RouterContext } from "#app/router-context.ts";
import { enterPublicFrame } from "#app/entry-conditions.ts";

const Route = createFileRoute("/_public")({
  beforeLoad: async ({
    context,
    location,
  }: Readonly<{ context: RouterContext; location: Readonly<{ pathname: string }> }>) =>
    enterPublicFrame(context.queryClient, location.pathname),
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
