import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { RecoveryAccepted, RecoveryOfferView } from "#shared/contracts/index.ts";

async function loadRecoveryOffer(): Promise<typeof RecoveryOfferView.Type> {
  const { api } = await userClient();
  return apiData(RecoveryOfferView, await api["recovery-offer"].get());
}

async function acceptRecovery(): Promise<typeof RecoveryAccepted.Type> {
  const { api } = await userClient();
  return apiData(RecoveryAccepted, await api.recovery.accept.post());
}

async function declineRecovery(): Promise<typeof RecoveryAccepted.Type> {
  const { api } = await userClient();
  return apiData(RecoveryAccepted, await api.recovery.decline.post());
}

export { acceptRecovery, declineRecovery, loadRecoveryOffer };
