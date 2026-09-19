import { Effect, Fiber } from "effect";
import { useEffect, useState } from "react";

import { authClient } from "./client.ts";
import { errorMessage, requireSuccess } from "./protocol.ts";

import type { PasskeySummary } from "./mfa-types.ts";

type PasskeyListing = {
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly listError: string | undefined;
};

const fetchPasskeys = async (): Promise<PasskeyListing> => {
  try {
    const listed = await authClient.passkey.listUserPasskeys();
    return { listError: undefined, passkeys: requireSuccess(listed) };
  } catch (failure) {
    return { listError: errorMessage(failure), passkeys: undefined };
  }
};

const usePasskeys = (): PasskeyListing & { readonly reload: () => Promise<void> } => {
  const [listing, setListing] = useState<PasskeyListing>({
    listError: undefined,
    passkeys: undefined,
  });
  const reload = async (): Promise<void> => {
    setListing(await fetchPasskeys());
  };
  useEffect(() => {
    const loading = Effect.runFork(
      Effect.map(Effect.promise(fetchPasskeys), (loaded) => {
        setListing(loaded);
      }),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, []);
  return { listError: listing.listError, passkeys: listing.passkeys, reload };
};

export { usePasskeys };
