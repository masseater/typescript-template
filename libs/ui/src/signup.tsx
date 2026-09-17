import { ActionStatus } from "./action-status";
import type { ReactElement } from "react";
import { SignUpFields } from "./signup-fields";
import { useAction } from "./action";

function SignUpForm({ onSent }: Readonly<{ onSent: () => void }>): ReactElement {
  const action = useAction();
  return (
    <div className="flex w-full flex-col gap-4">
      <SignUpFields action={action} onSent={onSent} />
      <ActionStatus action={action} pendingMessage="登録を処理しています。" />
    </div>
  );
}

export { SignUpForm };
