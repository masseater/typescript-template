import { PLAN } from "@repo/config";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { readCheckoutReturn } from "#pages/settings/index.ts";
import { loadUpgrade } from "#pages/upgrade/index.ts";
import { UpgradeRoute } from "./-upgrade-route.tsx";

import type { Upgrade } from "#pages/upgrade/index.ts";

async function loadOrLeave(): Promise<Upgrade> {
  const upgrade = await loadUpgrade();
  if (upgrade.plan.plan === PLAN.paid) {
    throw redirect({ replace: true, search: {}, to: "/settings/plan" });
  }
  return upgrade;
}

const Route = createFileRoute("/_member/upgrade")({
  component: UpgradeRoute,
  gcTime: 0,
  loader: loadOrLeave,
  validateSearch: readCheckoutReturn,
});

export { Route };
