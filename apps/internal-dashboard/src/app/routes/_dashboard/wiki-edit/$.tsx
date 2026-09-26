import { createFileRoute } from "@tanstack/react-router";

import { WikiEditRoute, loadWikiEditor } from "#pages/wiki-edit/index.ts";

const Route = createFileRoute("/_dashboard/wiki-edit/$")({
  component: WikiEditRoute,
  loader: ({
    params: { _splat: path = "" },
  }: Readonly<{ params: Readonly<{ _splat?: string }> }>) => loadWikiEditor(path),
});

export { Route };
