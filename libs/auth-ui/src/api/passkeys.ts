import { queryOptions } from "@tanstack/react-query";

import { authClient } from "../client.ts";
import { requireSuccess } from "../protocol.ts";

import type { PasskeySummary } from "../mfa-types.ts";

const passkeysKey = ["auth", "passkeys"] as const;

const listPasskeys = (): Promise<readonly PasskeySummary[]> =>
  authClient.passkey.listUserPasskeys().then(requireSuccess);

const passkeysOptions = queryOptions({
  queryFn: listPasskeys,
  queryKey: passkeysKey,
  retry: false,
});

export { passkeysKey, passkeysOptions };
