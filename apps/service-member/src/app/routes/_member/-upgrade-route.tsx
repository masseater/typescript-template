import { getRouteApi } from "@tanstack/react-router";

import { CHECKOUT_RETURN } from "#pages/settings/index.ts";
import { UpgradePage } from "#pages/upgrade/index.ts";

import type { ReactElement } from "react";

const route = getRouteApi("/_member/upgrade");

function UpgradeRoute(): ReactElement {
  const { checkout } = route.useSearch();
  const { offer } = route.useLoaderData();
  return <UpgradePage canceled={checkout === CHECKOUT_RETURN.cancel} offer={offer} />;
}

export { UpgradeRoute };
