import { authClient } from "./client";
import { requireSecureContext, requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { Separator } from "./shared/ui/separator";

import type { ReactElement } from "react";
import type { ActionState } from "./action";
import type { AuthenticatedHandler } from "./authenticated-handler";

const PasskeyLogin = ({
  action,
  onAuthenticated,
}: Readonly<{ action: ActionState; onAuthenticated: AuthenticatedHandler }>): ReactElement => {
  const signIn = (): void => {
    action.run(async () => {
      requireSecureContext();
      requireSuccess(await authClient.signIn.passkey());
      await onAuthenticated();
    });
  };
  return (
    <>
      <Separator label="または" />
      <Button type="button" disabled={action.blocked} onClick={signIn}>
        パスキーでログイン
      </Button>
    </>
  );
};

export { PasskeyLogin };
