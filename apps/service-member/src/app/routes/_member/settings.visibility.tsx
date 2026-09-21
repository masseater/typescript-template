import { createFileRoute } from "@tanstack/react-router";

import { loadVisibility } from "#pages/settings/index.ts";
import { VisibilityRoute } from "./-visibility-route.tsx";

const Route = createFileRoute("/_member/settings/visibility")({
  component: VisibilityRoute,
  gcTime: 0,
  loader: loadVisibility,
});

export { Route };
