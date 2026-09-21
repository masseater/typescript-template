import { queryOptions } from "@tanstack/react-query";

import { authClient } from "../client.ts";
import { requireSuccess } from "../protocol.ts";

import type { PasskeySummary } from "../mfa-types.ts";

const passkeysKey = ["auth", "passkeys"] as const;

const listPasskeys = async (): Promise<readonly PasskeySummary[]> =>
  requireSuccess(await authClient.passkey.listUserPasskeys());

const passkeysOptions = queryOptions({
  queryFn: listPasskeys,
  queryKey: passkeysKey,
  retry: false,
});

export { passkeysKey, passkeysOptions };
