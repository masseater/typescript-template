import { useAction, type ActionState } from "@repo/ui";
import { Cause, Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { errorMessage, requireSuccess } from "./protocol";

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

const reportTo =
  (onFailure: (failureMessage: string) => void) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
    Effect.sync(() => {
      onFailure(errorMessage(Cause.squash(cause)));
    });

const useSignOut = (
  destination = "/login",
  onFailure: (failureMessage: string) => void = () => undefined,
): Readonly<{ action: ActionState; signOut: () => void }> => {
  const action = useAction();
  const signOut = (): void => {
    action.run(() =>
      Effect.runPromise(signOutTo(destination).pipe(Effect.tapCause(reportTo(onFailure)))),
    );
  };
  return { action, signOut };
};

export { useSignOut };
