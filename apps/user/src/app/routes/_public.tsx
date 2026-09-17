import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "#widgets/public-frame/index.ts";
import type { ReactElement } from "react";
import { enterPublicFrame } from "#app/entry-conditions.ts";

const Route = createFileRoute("/_public")({
  beforeLoad: async ({ location }: Readonly<{ location: Readonly<{ pathname: string }> }>) =>
    enterPublicFrame(location.pathname),
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
