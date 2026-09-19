import { createFileRoute } from "@tanstack/react-router";

import { PlanPage } from "#pages/settings/index.ts";

const Route = createFileRoute("/_member/settings/plan")({
  component: PlanPage,
});

export { Route };
