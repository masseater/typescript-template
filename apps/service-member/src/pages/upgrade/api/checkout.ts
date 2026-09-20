import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { HostedPage, OfferView, PlanView } from "#shared/contracts/index.ts";

type Offer = typeof OfferView.Type;

interface Upgrade {
  readonly offer: Offer | undefined;
  readonly plan: typeof PlanView.Type;
}

async function loadOffer(
  api: Awaited<ReturnType<typeof userClient>>["api"],
): Promise<Offer | undefined> {
  const reply = await api.billing.offer.get();
  return reply.error === null ? apiData(OfferView, reply) : undefined;
}

async function loadUpgrade(): Promise<Upgrade> {
  const { api } = await userClient();
  const [plan, offer] = await Promise.all([
    api.billing.plan.get().then((reply) => apiData(PlanView, reply)),
    loadOffer(api),
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
