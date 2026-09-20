import { getRouteApi } from "@tanstack/react-router";

import { CHECKOUT_RETURN, PlanPage } from "#pages/settings/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/settings/plan");

function PlanRoute(): ReactElement {
  const { checkout } = route.useSearch();
  return (
    <PlanPage
      awaitingCheckout={checkout === CHECKOUT_RETURN.success}
      plan={route.useLoaderData()}
    />
  );
}

export { PlanRoute };
