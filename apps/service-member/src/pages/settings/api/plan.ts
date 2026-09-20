import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HostedPage, PlanView } from "#shared/contracts/index.ts";

type Plan = typeof PlanView.Type;

async function loadPlan(): Promise<Plan> {
  const { api } = await userClient();
  return apiData(PlanView, await api.billing.plan.get());
}

async function openPortal(): Promise<void> {
  const { api } = await userClient();
  const { url } = apiData(HostedPage, await api.billing.portal.post({}));
  globalThis.location.assign(url);
}

export { loadPlan, openPortal };
export type { Plan };
