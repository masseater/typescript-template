import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";
import { Button } from "smarthr-ui";
import type { ReactElement } from "react";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";

function PasskeyLoginButton({
  action,
  onAuthenticated,
}: Readonly<{ action: ActionState; onAuthenticated: AuthenticatedHandler }>): ReactElement {
  const { run } = action;
  const signIn = useCallback(() => {
    run(async () => {
      if (!globalThis.isSecureContext) {
        throw new Error("パスキーには HTTPS または localhost が必要です。");
      }
      requireSuccess(await authClient.signIn.passkey());
      await onAuthenticated();
    });
  }, [onAuthenticated, run]);
  return (
    <Button type="button" disabled={action.blocked} onClick={signIn}>
      パスキーでログイン
    </Button>
  );
}

export { PasskeyLoginButton };
