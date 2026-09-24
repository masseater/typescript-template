import { getRouteApi } from "@tanstack/react-router";

import { ConsentPage } from "./consent-page.tsx";

import type { ReactElement } from "react";

const route = getRouteApi("/consent");

function ConsentRoute(): ReactElement {
  return <ConsentPage client={route.useLoaderData()} />;
}

export { ConsentRoute };
