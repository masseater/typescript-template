import { ActionStatus } from "./action-status";
import { Button } from "./shared/ui/button";
import type { ReactElement } from "react";
import { useSignOut } from "./use-sign-out";

function SignOutButton({
  destination,
}: Readonly<{ destination?: string | undefined }>): ReactElement {
  const { action, signOut } = useSignOut(destination);
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
