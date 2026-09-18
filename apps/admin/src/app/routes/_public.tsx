import { Outlet, createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { PublicFrame } from "#widgets/public-frame/index.ts";

const Route = createFileRoute("/_public")({
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
