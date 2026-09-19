import { createFileRoute } from "@tanstack/react-router";

import { DocsPage, loadWikiPage } from "#pages/docs/index.ts";

import type { ReactElement } from "react";

function WikiIndexPage(): ReactElement {
  return <DocsPage data={Route.useLoaderData()} />;
}

const Route = createFileRoute("/wiki/")({
  component: WikiIndexPage,
  loader: async () => loadWikiPage({ data: [] }),
});

export { Route };
