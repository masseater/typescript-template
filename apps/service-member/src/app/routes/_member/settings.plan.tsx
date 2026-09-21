import { createFileRoute } from "@tanstack/react-router";

import { loadPlan } from "#pages/settings/index.ts";
import { readCheckoutReturn } from "#shared/contracts/index.ts";
import { PlanRoute } from "./-plan-route.tsx";

const Route = createFileRoute("/_member/settings/plan")({
  validateSearch: readCheckoutReturn,
  loader: loadPlan,
  gcTime: 0,
  component: PlanRoute,
});

export { Route };
