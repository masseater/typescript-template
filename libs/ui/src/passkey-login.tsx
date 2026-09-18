import { requireSecureContext, requireSuccess } from "./protocol";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "./shared/ui/button";
import type { ReactElement } from "react";
import { Separator } from "./shared/ui/separator";
import { authClient } from "./client";

function PasskeyLogin({
  action,
  onAuthenticated,
}: Readonly<{ action: ActionState; onAuthenticated: AuthenticatedHandler }>): ReactElement {
  function signIn(): void {
    action.run(async () => {
      requireSecureContext();
      requireSuccess(await authClient.signIn.passkey());
      await onAuthenticated();
    });
  }
  return (
    <>
      <Separator label="または" />
      <Button type="button" disabled={action.blocked} onClick={signIn}>
        パスキーでログイン
      </Button>
    </>
  );
}

export { PasskeyLogin };
