import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "#widgets/public-frame/index.ts";
import type { ReactElement } from "react";

const Route = createFileRoute("/_public")({
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
