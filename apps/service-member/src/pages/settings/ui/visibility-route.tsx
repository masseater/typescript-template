import { getRouteApi } from "@tanstack/react-router";

import { VisibilityPage } from "./visibility-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/visibility");

function VisibilityRoute(): ReactElement {
  return <VisibilityPage initial={route.useLoaderData()} />;
}

export { VisibilityRoute };
