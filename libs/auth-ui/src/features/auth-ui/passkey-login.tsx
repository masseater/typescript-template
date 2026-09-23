import { type ActionState, Button, Separator } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSecureContext, requireSuccess } from "./protocol";

import type { ReactElement } from "react";
import type { AuthenticatedHandler } from "./authenticated-handler";

const signInWithPasskey = (onAuthenticated: AuthenticatedHandler): Effect.Effect<void> =>
  Effect.gen(function* authenticateWithPasskey() {
    requireSecureContext();
    requireSuccess(yield* authTask(() => authClient.signIn.passkey()));
    yield* authTask(() => Promise.resolve(onAuthenticated()));
  });

const PasskeyLogin = ({
  action,
  onAuthenticated,
}: Readonly<{ action: ActionState; onAuthenticated: AuthenticatedHandler }>): ReactElement => {
  const signIn = (): void => {
    action.run(() => Effect.runPromise(signInWithPasskey(onAuthenticated)));
  };
  return (
    <>
      <Separator label="または" />
      <Button type="button" disabled={action.blocked} onClick={signIn}>
        {"パスキーでログイン"}
      </Button>
    </>
  );
};

export { PasskeyLogin };
