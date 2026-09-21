import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { localState, requestAtom, type RequestResult } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { wikiClient } from "#shared/api/index.ts";
import { FlagList, FlagToggled } from "#shared/contracts/index.ts";

import type { FlagEntry } from "#shared/contracts/index.ts";

function fetchFlags(): Promise<readonly FlagEntry[]> {
  return Promise.resolve(wikiClient()).then(({ api }) =>
    api.flags.get().then((response) => apiData(FlagList, response).flags),
  );
}

const flagsAtom = requestAtom(() => fetchFlags());

const useOverrides = localState<Readonly<Record<string, FlagEntry>>>({});

function useFlagList(): Readonly<{
  flags: readonly FlagEntry[] | undefined;
  listing: RequestResult<readonly FlagEntry[]>;
  reload: () => void;
  toggle: (key: FlagEntry["key"], enabled: boolean) => Promise<string | undefined>;
}> {
  const listing = useAtomValue(flagsAtom);
  const reloadRemote = useAtomRefresh(flagsAtom);
  const [overrides, setOverrides] = useOverrides();

  const reload = (): void => {
    setOverrides({});
    reloadRemote();
  };

  const toggle = (key: FlagEntry["key"], enabled: boolean): Promise<string | undefined> =>
    Promise.resolve(wikiClient())
      .then(({ api }) => api.flags.patch({ enabled, key }))
      .then((response) => {
        const updated = apiData(FlagToggled, response);
        setOverrides((current) => ({ ...current, [updated.key]: updated }));
        return undefined;
      })
      .catch((error: unknown) => errorMessage(error));

  const flags = AsyncResult.isSuccess(listing)
    ? listing.value.map((entry) => overrides[entry.key] ?? entry)
    : undefined;

  return { flags, listing, reload, toggle };
}

export { useFlagList };
