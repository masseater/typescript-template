import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { loadRecoveryOffer } from "#pages/recovery/api/recovery.ts";

import type { RecoveryOfferView } from "#shared/contracts/index.ts";

interface RecoveryOfferState {
  readonly error: string | undefined;
  readonly offer: typeof RecoveryOfferView.Type | undefined;
  readonly reload: () => void;
}

const recoveryOfferAtom = requestAtom(async () => loadRecoveryOffer());

function useRecoveryOffer(): RecoveryOfferState {
  const loaded = useAtomValue(recoveryOfferAtom);
  const reload = useAtomRefresh(recoveryOfferAtom);
  return {
    error: resultError(loaded),
    offer: AsyncResult.isSuccess(loaded) ? loaded.value : undefined,
    reload,
  };
}

export { useRecoveryOffer };
