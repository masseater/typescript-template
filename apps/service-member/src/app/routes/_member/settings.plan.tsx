import { createFileRoute } from "@tanstack/react-router";

import { PlanRoute, loadPlan } from "#pages/settings/index.ts";
import { readCheckoutReturn } from "#shared/contracts/index.ts";

const Route = createFileRoute("/_member/settings/plan")({
  validateSearch: readCheckoutReturn,
  loader: loadPlan,
  gcTime: 0,
  component: PlanRoute,
});

export { Route };
