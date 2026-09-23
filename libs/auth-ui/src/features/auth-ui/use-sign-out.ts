import { useAction, type ActionState } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";

const signOutTo = (destination: string): Effect.Effect<void> =>
  authTask(() => authClient.signOut()).pipe(
    Effect.map(requireSuccess),
    Effect.tap(() =>
      Effect.sync(() => {
        globalThis.location.assign(destination);
      }),
    ),
    Effect.asVoid,
    Effect.orDie,
  );

const useSignOut = (
  destination = "/login",
): Readonly<{ action: ActionState; signOut: () => void }> => {
  const action = useAction();
  const signOut = (): void => {
    action.run(() => Effect.runPromise(signOutTo(destination)));
  };
  return { action, signOut };
};

export { useSignOut };
