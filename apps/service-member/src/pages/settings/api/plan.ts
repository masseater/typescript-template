import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HostedPage, PlanView } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type Plan = typeof PlanView.Type;

function loadPlan(): Promise<Plan> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.billing.plan.get().then((response: ApiReply) => apiData(PlanView, response)),
  );
}

function openPortal(): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.billing.portal.post({}).then((response: ApiReply) => {
      globalThis.location.assign(apiData(HostedPage, response).url);
    }),
  );
}

export { loadPlan, openPortal };
export type { Plan };
