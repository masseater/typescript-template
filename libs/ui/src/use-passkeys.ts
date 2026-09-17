import { errorMessage, requireSuccess } from "./protocol";
import { useEffect, useState } from "react";
import type { PasskeySummary } from "./mfa-types";
import { authClient } from "./client";

interface PasskeyListing {
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly listError: string | undefined;
}

interface PasskeysState extends PasskeyListing {
  readonly reload: () => Promise<void>;
}

async function fetchPasskeys(): Promise<PasskeyListing> {
  try {
    const result = await authClient.passkey.listUserPasskeys();
    return { listError: undefined, passkeys: requireSuccess(result) };
  } catch (error) {
    return { listError: errorMessage(error), passkeys: undefined };
  }
}

function usePasskeys(): PasskeysState {
  const [listing, setListing] = useState<PasskeyListing>({
    listError: undefined,
    passkeys: undefined,
  });
  async function reload(): Promise<void> {
    setListing(await fetchPasskeys());
  }
  useEffect(() => {
    async function load(): Promise<void> {
      setListing(await fetchPasskeys());
    }
    void load();
  }, []);
  return { listError: listing.listError, passkeys: listing.passkeys, reload };
}

export { usePasskeys };
