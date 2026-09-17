import { ActionStatus } from "./action-status";
import { FormColumn } from "./shared/ui";
import type { ReactElement } from "react";
import { SignUpFields } from "./signup-fields";
import { useAction } from "./action";

function SignUpForm({ onSent }: Readonly<{ onSent: () => void }>): ReactElement {
  const action = useAction();
  return (
    <FormColumn>
      <SignUpFields action={action} onSent={onSent} />
      <ActionStatus action={action} pendingMessage="登録を処理しています。" />
    </FormColumn>
  );
}

export { SignUpForm };
