import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { RecoveryAccepted, RecoveryOfferView } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

function loadRecoveryOffer(): Promise<typeof RecoveryOfferView.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api["recovery-offer"].get().then((response: ApiReply) => apiData(RecoveryOfferView, response)),
  );
}

function acceptRecovery(): Promise<typeof RecoveryAccepted.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.recovery.accept.post().then((response: ApiReply) => apiData(RecoveryAccepted, response)),
  );
}

function declineRecovery(): Promise<typeof RecoveryAccepted.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.recovery.decline.post().then((response: ApiReply) => apiData(RecoveryAccepted, response)),
  );
}

export { acceptRecovery, declineRecovery, loadRecoveryOffer };
