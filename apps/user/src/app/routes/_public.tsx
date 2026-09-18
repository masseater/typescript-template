import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicFrame } from "#widgets/public-frame/index.ts";
import type { ReactElement } from "react";
import type { RouterContext } from "#app/router-context.ts";
import { enterPublicFrame } from "#app/entry-conditions.ts";

interface RouteArguments {
  readonly context: RouterContext;
  readonly location: Readonly<{ pathname: string }>;
}

const Route = createFileRoute("/_public")({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  beforeLoad: async ({ context, location }: RouteArguments) =>
    enterPublicFrame(context.queryClient, location.pathname),
  component: (): ReactElement => (
    <PublicFrame>
      <Outlet />
    </PublicFrame>
  ),
});

export { Route };
