import { useAction, ActionStatus, FormColumn } from "@repo/ui";

import { SignUpFields } from "./signup-fields";

import type { ReactElement } from "react";

const SignUpForm = ({ onSent }: Readonly<{ onSent: () => void }>): ReactElement => {
  const action = useAction();
  return (
    <FormColumn>
      <SignUpFields action={action} onSent={onSent} />
      <ActionStatus action={action} pendingMessage="登録を処理しています。" />
    </FormColumn>
  );
};

export { SignUpForm };
