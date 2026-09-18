import { requestAtom, resultError } from "./request";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import type { PasskeySummary } from "./mfa-types";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface PasskeysState {
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly reload: () => void;
}

const passkeysAtom = requestAtom(async () =>
  requireSuccess(await authClient.passkey.listUserPasskeys()),
);

function usePasskeys(): PasskeysState {
  const result = useAtomValue(passkeysAtom);
  const reload = useAtomRefresh(passkeysAtom);
  return {
    listError: resultError(result),
    passkeys: AsyncResult.isSuccess(result) ? result.value : undefined,
    reload,
  };
}

export { usePasskeys };
