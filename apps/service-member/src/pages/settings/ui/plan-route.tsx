import { getRouteApi } from "@tanstack/react-router";

import { PlanPage } from "./plan-page.tsx";
import { CHECKOUT_RETURN } from "#shared/contracts/index.ts";

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
