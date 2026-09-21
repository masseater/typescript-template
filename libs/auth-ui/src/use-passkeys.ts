import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { authClient } from "./client.ts";
import { requireSuccess } from "./protocol.ts";

import type { PasskeySummary } from "./mfa-types.ts";

const passkeysAtom = requestAtom(async () =>
  requireSuccess(await authClient.passkey.listUserPasskeys()),
);

const usePasskeys = (): {
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly reload: () => void;
} => {
  const listing = useAtomValue(passkeysAtom);
  const reload = useAtomRefresh(passkeysAtom);
  return {
    listError: resultError(listing),
    passkeys: AsyncResult.isSuccess(listing) ? listing.value : undefined,
    reload,
  };
};

export { usePasskeys };
