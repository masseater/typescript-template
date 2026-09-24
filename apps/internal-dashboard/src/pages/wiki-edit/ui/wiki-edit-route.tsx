import { getRouteApi } from "@tanstack/react-router";

import { WikiEditPage } from "./wiki-edit-page.tsx";

import type { ReactElement } from "react";

const editRoute = getRouteApi("/_dashboard/wiki-edit/$");

function WikiEditRoute(): ReactElement {
  const data = editRoute.useLoaderData();
  return (
    <WikiEditPage
      key={`${data.source.path}:${String(data.source.draft?.version ?? 0)}`}
      data={data}
    />
  );
}

export { WikiEditRoute };
