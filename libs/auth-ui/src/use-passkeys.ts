import { Effect, Fiber, Schema } from "effect";
import { useEffect, useState } from "react";

import { authClient } from "./client.ts";
import { errorMessage, requireSuccess } from "./protocol.ts";

import type { PasskeySummary } from "./mfa-types.ts";

type PasskeyListing = {
  readonly passkeys: readonly PasskeySummary[] | undefined;
  readonly listError: string | undefined;
};

class PasskeyListFailed extends Schema.TaggedError<PasskeyListFailed>()("PasskeyListFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
}) {}

const fetchPasskeys = (): Effect.Effect<PasskeyListing> =>
  Effect.tryPromise({
    try: async () => {
      const listed = await authClient.passkey.listUserPasskeys();
      return { listError: undefined, passkeys: requireSuccess(listed) };
    },
    catch: (cause) => new PasskeyListFailed({ cause }),
  }).pipe(
    Effect.match({
      onFailure: (failure) => ({
        listError: errorMessage(failure.cause ?? failure),
        passkeys: undefined,
      }),
      onSuccess: (listing) => listing,
    }),
  );

const usePasskeys = (): PasskeyListing & { readonly reload: () => Promise<void> } => {
  const [listing, setListing] = useState<PasskeyListing>({
    listError: undefined,
    passkeys: undefined,
  });
  const reload = async (): Promise<void> => {
    setListing(await Effect.runPromise(fetchPasskeys()));
  };
  useEffect(() => {
    const loading = Effect.runFork(
      Effect.map(fetchPasskeys(), (loaded) => {
        setListing(loaded);
      }),
    );
    return (): void => {
      Effect.runFork(Fiber.interrupt(loading));
    };
  }, []);
  return { ...listing, reload };
};

export { usePasskeys };
