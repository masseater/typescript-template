import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";

import { passkeysKey, passkeysOptions } from "./api/passkeys.ts";
import { errorMessage } from "./protocol.ts";

import type { PasskeySummary } from "./mfa-types.ts";

const usePasskeys = (): {
  readonly listError: string | undefined;
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly reload: () => void;
} => {
  const queries = useQueryClient();
  const listed = useQuery(passkeysOptions);
  const reload = (): void => {
    Effect.runFork(Effect.promise(() => queries.invalidateQueries({ queryKey: passkeysKey })));
  };
  return {
    listError: listed.error === null ? undefined : errorMessage(listed.error),
    passkeys: listed.data,
    reload,
  };
};

export { usePasskeys };
