import { createFileRoute } from "@tanstack/react-router";

import { WikiDocRoute, loadWikiPage } from "#pages/docs/index.ts";

const Route = createFileRoute("/wiki/$")({
  component: WikiDocRoute,
  loader: ({ location }: Readonly<{ location: Readonly<{ pathname: string }> }>) =>
    loadWikiPage({
      data: location.pathname
        .replace(/^\/wiki\/?/, "")
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment)),
    }),
});

export { Route };
