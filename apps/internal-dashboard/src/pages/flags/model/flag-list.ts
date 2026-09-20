import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { useEffect, useState } from "react";

import { wikiClient } from "#shared/api/index.ts";
import { FlagList, FlagToggled } from "#shared/contracts/index.ts";

import type { FlagEntry } from "#shared/contracts/index.ts";

type FlagListState =
  | Readonly<{ flags: readonly FlagEntry[]; status: "loaded" }>
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ status: "loading" }>;

async function fetchFlags(): Promise<FlagListState> {
  try {
    const { flags } = apiData(FlagList, await wikiClient().flags.get());
    return { flags, status: "loaded" };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
}

function useFlagList(): Readonly<{
  reload: () => void;
  state: FlagListState;
  toggle: (key: FlagEntry["key"], enabled: boolean) => Promise<string | undefined>;
}> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FlagListState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    void fetchFlags().then((next) => {
      if (active) {
        setState(next);
      }
    });
    return () => {
      active = false;
    };
  }, [attempt]);

  const toggle = async (key: FlagEntry["key"], enabled: boolean): Promise<string | undefined> => {
    try {
      const updated = apiData(FlagToggled, await wikiClient().flags.patch({ enabled, key }));
      setState((current) =>
        current.status === "loaded"
          ? {
              flags: current.flags.map((entry) => (entry.key === updated.key ? updated : entry)),
              status: "loaded",
            }
          : current,
      );
      return undefined;
    } catch (error) {
      return errorMessage(error);
    }
  };

  return { reload: () => setAttempt((value) => value + 1), state, toggle };
}

export { useFlagList };
