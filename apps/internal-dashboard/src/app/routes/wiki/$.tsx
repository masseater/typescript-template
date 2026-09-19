import { createFileRoute } from "@tanstack/react-router";

import { DocsPage, loadWikiPage } from "#pages/docs/index.ts";

import type { ReactElement } from "react";

function WikiDocPage(): ReactElement {
  return <DocsPage data={Route.useLoaderData()} />;
}

const Route = createFileRoute("/wiki/$")({
  component: WikiDocPage,
  loader: async ({ location }: Readonly<{ location: Readonly<{ pathname: string }> }>) =>
    loadWikiPage({
      data: location.pathname
        .replace(/^\/wiki\/?/, "")
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment)),
    }),
});

export { Route };
