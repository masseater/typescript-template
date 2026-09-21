import { PLAN } from "@repo/config";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { UpgradeFailed, loadUpgrade } from "#pages/upgrade/index.ts";
import { readCheckoutReturn } from "#shared/contracts/index.ts";
import { UpgradeRoute } from "./-upgrade-route.tsx";

import type { Upgrade } from "#pages/upgrade/index.ts";

async function loadOrLeave(): Promise<Upgrade> {
  const upgrade = await loadUpgrade();
  if (upgrade.plan.plan === PLAN.paid) {
    throw redirect({ replace: true, search: {}, to: "/settings/plan" });
  }
  return upgrade;
}

// oxlint-disable-next-line eslint/sort-keys -- TanStack Start infers search and loader dependencies from the order of these route options, and alphabetical order breaks that inference
const Route = createFileRoute("/_member/upgrade")({
  validateSearch: readCheckoutReturn,
  loader: loadOrLeave,
  gcTime: 0,
  component: UpgradeRoute,
  errorComponent: UpgradeFailed,
});

export { Route };
