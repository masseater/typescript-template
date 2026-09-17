import { ActionStatus } from "./action-status";
import { Button } from "./shared/ui";
import type { ReactElement } from "react";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useAction } from "./action";

function SignOutButton(): ReactElement {
  const action = useAction();
  function signOut(): void {
    action.run(async () => {
      requireSuccess(await authClient.signOut());
      globalThis.location.assign("/login");
    });
  }
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
