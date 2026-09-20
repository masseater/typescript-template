import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HostedPage, OfferView, PlanView } from "#shared/contracts/index.ts";

type Offer = typeof OfferView.Type;

interface Upgrade {
  readonly offer: Offer;
  readonly plan: typeof PlanView.Type;
}

async function loadUpgrade(): Promise<Upgrade> {
  const { api } = await userClient();
  const [plan, offer] = await Promise.all([
    api.billing.plan.get().then((reply) => apiData(PlanView, reply)),
    api.billing.offer.get().then((reply) => apiData(OfferView, reply)),
  ]);
  return { offer, plan };
}

async function startCheckout(): Promise<void> {
  const { api } = await userClient();
  const { url } = apiData(HostedPage, await api.billing.checkout.post({}));
  globalThis.location.assign(url);
}

export { loadUpgrade, startCheckout };
export type { Offer, Upgrade };
