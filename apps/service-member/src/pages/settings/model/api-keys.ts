import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { requestAtom, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { loadApiKeys, type ListedApiKey } from "#pages/settings/api/api-keys.ts";

interface ApiKeyList {
  readonly error: string | undefined;
  readonly keys: readonly ListedApiKey[] | undefined;
  readonly reload: () => void;
}

const apiKeysAtom = requestAtom(async () => loadApiKeys());

function useApiKeys(): ApiKeyList {
  const loaded = useAtomValue(apiKeysAtom);
  const reload = useAtomRefresh(apiKeysAtom);
  return {
    error: resultError(loaded),
    keys: AsyncResult.isSuccess(loaded) ? loaded.value : undefined,
    reload,
  };
}

export { useApiKeys };
