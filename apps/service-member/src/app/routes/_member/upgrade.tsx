import { PLAN } from "@repo/config";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { UpgradeFailed, UpgradeRoute, loadUpgrade } from "#pages/upgrade/index.ts";
import { readCheckoutReturn } from "#shared/contracts/index.ts";

import type { Upgrade } from "#pages/upgrade/index.ts";
function loadOrLeave(): Promise<Upgrade> {
  return loadUpgrade().then((upgrade) =>
    Promise.resolve().then(() => {
      if (upgrade.plan.plan === PLAN.paid) {
        throw redirect({
          replace: true,
          search: {},
          to: "/settings/plan",
        });
      }
      return upgrade;
    }),
  );
}
const Route = createFileRoute("/_member/upgrade")({
  validateSearch: readCheckoutReturn,
  loader: loadOrLeave,
  gcTime: 0,
  component: UpgradeRoute,
  errorComponent: UpgradeFailed,
});
export { Route };
