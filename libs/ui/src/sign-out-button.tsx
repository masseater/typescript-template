import { ActionStatus } from "./action-status";
import { Button } from "smarthr-ui";
import type { ReactElement } from "react";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";
import { useCallback } from "react";

function SignOutButton(): ReactElement {
  const action = useAction();
  const { run } = action;
  const signOut = useCallback(() => {
    run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign("/login");
    });
  }, [run]);
  return (
    <>
      <Button type="button" disabled={action.blocked} onClick={signOut}>
        ログアウト
      </Button>
      <ActionStatus action={action} />
    </>
  );
}

export { SignOutButton };
