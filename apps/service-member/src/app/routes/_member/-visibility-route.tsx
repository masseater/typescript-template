import { getRouteApi } from "@tanstack/react-router";

import { VisibilityPage } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/visibility");

function VisibilityRoute(): ReactElement {
  return <VisibilityPage initial={route.useLoaderData()} />;
}

export { VisibilityRoute };
