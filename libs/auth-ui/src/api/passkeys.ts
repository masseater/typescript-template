import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";

import { authClient } from "../client.ts";
import { requireSuccess } from "../protocol.ts";

import type { PasskeySummary } from "../mfa-types.ts";

const passkeysKey = ["auth", "passkeys"] as const;

const listPasskeys = (): Promise<readonly PasskeySummary[]> =>
  Effect.runPromise(
    Effect.gen(function* listUserPasskeys() {
      return requireSuccess(yield* Effect.promise(() => authClient.passkey.listUserPasskeys()));
    }),
  );

const passkeysOptions = queryOptions({
  queryFn: listPasskeys,
  queryKey: passkeysKey,
  retry: false,
});

export { passkeysKey, passkeysOptions };
