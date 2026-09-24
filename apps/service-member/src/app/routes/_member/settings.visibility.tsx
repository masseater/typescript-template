import { createFileRoute } from "@tanstack/react-router";

import { VisibilityRoute, loadVisibility } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/visibility")({
  component: VisibilityRoute,
  gcTime: 0,
  loader: loadVisibility,
});

export { Route };
