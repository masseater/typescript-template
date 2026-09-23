import { ActionStatus, Button } from "@repo/ui";

import { useSignOut } from "./use-sign-out";

import type { ReactElement } from "react";

const SignOutButton = ({
  destination,
}: Readonly<{ destination?: string | undefined }>): ReactElement => {
  const { action, signOut } = useSignOut(destination);
  return (
    <>
      <Button type="button" disabled={action.blocked} onClick={signOut}>
        {"ログアウト"}
      </Button>
      <ActionStatus action={action} />
    </>
  );
};

export { SignOutButton };
