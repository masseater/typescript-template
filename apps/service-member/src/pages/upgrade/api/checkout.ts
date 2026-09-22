import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HostedPage, OfferView, PlanView } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type Offer = typeof OfferView.Type;

interface Upgrade {
  readonly offer: Offer;
  readonly plan: typeof PlanView.Type;
}

function loadUpgrade(): Promise<Upgrade> {
  return Promise.resolve(userClient()).then(({ api }) =>
    Promise.all([
      api.billing.plan.get().then((reply: ApiReply) => apiData(PlanView, reply)),
      api.billing.offer.get().then((reply: ApiReply) => apiData(OfferView, reply)),
    ]).then(([plan, offer]) => ({ offer, plan })),
  );
}

function startCheckout(): Promise<void> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.billing.checkout.post({}).then((response: ApiReply) => {
      globalThis.location.assign(apiData(HostedPage, response).url);
    }),
  );
}

export { loadUpgrade, startCheckout };
export type { Offer, Upgrade };
