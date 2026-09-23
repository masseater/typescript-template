import { getRouteApi } from "@tanstack/react-router";

import { DocsPage } from "./docs-page.tsx";

import type { ReactElement } from "react";

const indexRoute = getRouteApi("/wiki/");
const docRoute = getRouteApi("/wiki/$");

function WikiIndexRoute(): ReactElement {
  return <DocsPage data={indexRoute.useLoaderData()} />;
}

function WikiDocRoute(): ReactElement {
  return <DocsPage data={docRoute.useLoaderData()} />;
}

export { WikiDocRoute, WikiIndexRoute };
