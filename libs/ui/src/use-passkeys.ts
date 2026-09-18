import { useEffect, useState } from "react";

import { authClient } from "./client";
import { errorMessage, requireSuccess } from "./protocol";

import type { PasskeySummary } from "./mfa-types";

type PasskeyListing = {
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly listError: string | undefined;
};

type PasskeysState = {
  readonly reload: () => Promise<void>;
} & PasskeyListing;

const fetchPasskeys = async (): Promise<PasskeyListing> => {
  try {
    const result = await authClient.passkey.listUserPasskeys();
    return { listError: undefined, passkeys: requireSuccess(result) };
  } catch (error) {
    return { listError: errorMessage(error), passkeys: undefined };
  }
};

const usePasskeys = (): PasskeysState => {
  const [listing, setListing] = useState<PasskeyListing>({
    listError: undefined,
    passkeys: undefined,
  });
  const reload = async (): Promise<void> => {
    setListing(await fetchPasskeys());
  };
  useEffect(() => {
    const load = async (): Promise<void> => {
      setListing(await fetchPasskeys());
    };
    void load();
  }, []);
  return { listError: listing.listError, passkeys: listing.passkeys, reload };
};

export { usePasskeys };
