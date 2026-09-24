import { useAction } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { openPortal } from "#pages/settings/api/plan.ts";
import { summarizePlan } from "#pages/settings/model/plan-summary.ts";
import { PlanView } from "./plan-view.tsx";

import type { Plan } from "#pages/settings/api/plan.ts";
import type { ReactElement } from "react";

function PlanPage({
  awaitingCheckout,
  plan,
}: Readonly<{ awaitingCheckout: boolean; plan: Plan }>): ReactElement {
  const router = useRouter();
  const action = useAction();
  const summary = summarizePlan(plan);
  function manage(): void {
    action.run(openPortal);
  }
  function reload(): void {
    void router.invalidate();
  }
  return (
    <PlanView
      action={action}
      checkoutPending={awaitingCheckout && summary.upgradable}
      onManage={manage}
      onReload={reload}
      summary={summary}
    />
  );
}

export { PlanPage };
