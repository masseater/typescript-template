import { createFileRoute } from "@tanstack/react-router";

import { WikiIndexRoute, loadWikiPage } from "#pages/docs/index.ts";

const Route = createFileRoute("/wiki/")({
  component: WikiIndexRoute,
  loader: () => loadWikiPage({ data: [] }),
});

export { Route };
