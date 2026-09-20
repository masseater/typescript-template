import { createFileRoute } from "@tanstack/react-router";

import { loadPlan, readCheckoutReturn } from "#pages/settings/index.ts";
import { PlanRoute } from "./-plan-route.tsx";

const Route = createFileRoute("/_member/settings/plan")({
  component: PlanRoute,
  gcTime: 0,
  loader: loadPlan,
  validateSearch: readCheckoutReturn,
});

export { Route };
