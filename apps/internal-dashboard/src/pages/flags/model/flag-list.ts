import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { localState, requestAtom, type RequestResult } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { wikiClient } from "#shared/api/index.ts";
import { FlagList, FlagToggled } from "#shared/contracts/index.ts";

import type { FlagEntry } from "#shared/contracts/index.ts";

async function fetchFlags(): Promise<readonly FlagEntry[]> {
  const { flags } = apiData(FlagList, await wikiClient().flags.get());
  return flags;
}

const flagsAtom = requestAtom(async () => fetchFlags());

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

  const toggle = async (key: FlagEntry["key"], enabled: boolean): Promise<string | undefined> => {
    try {
      const updated = apiData(FlagToggled, await wikiClient().flags.patch({ enabled, key }));
      setOverrides((current) => ({ ...current, [updated.key]: updated }));
      return undefined;
    } catch (error) {
      return errorMessage(error);
    }
  };

  const flags = AsyncResult.isSuccess(listing)
    ? listing.value.map((entry) => overrides[entry.key] ?? entry)
    : undefined;

  return { flags, listing, reload, toggle };
}

export { useFlagList };
