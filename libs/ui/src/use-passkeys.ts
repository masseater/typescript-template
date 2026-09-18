import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { request, resultError } from "./request";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import type { PasskeySummary } from "./mfa-types";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

interface PasskeysState {
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly reload: () => void;
}

const passkeysAtom = Atom.make(
  request(async () => requireSuccess(await authClient.passkey.listUserPasskeys())),
).pipe(Atom.withServerValueInitial);

function usePasskeys(): PasskeysState {
  const result = useAtomValue(passkeysAtom);
  const reload = useAtomRefresh(passkeysAtom);
  return {
    listError: resultError(result),
    passkeys: Option.getOrUndefined(AsyncResult.value(result)),
    reload,
  };
}

export { usePasskeys };
