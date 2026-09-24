import { createFileRoute } from "@tanstack/react-router";

import { WikiEditRoute, loadWikiEditor } from "#pages/wiki-edit/index.ts";

const Route = createFileRoute("/_dashboard/wiki-edit/$")({
  component: WikiEditRoute,
  loader: ({ params }: Readonly<{ params: Readonly<{ _splat?: string }> }>) =>
    loadWikiEditor(params._splat ?? ""),
});

export { Route };
