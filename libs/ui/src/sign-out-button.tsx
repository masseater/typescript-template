import { ActionStatus } from "./action-status";
import { Button } from "./shared/ui";
import type { ReactElement } from "react";
import { useSignOut } from "./use-sign-out";

function SignOutButton(): ReactElement {
  const { action, signOut } = useSignOut();
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
