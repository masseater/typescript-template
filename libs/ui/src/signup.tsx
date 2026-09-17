import { ActionStatus } from "./action-status";
import type { ReactElement } from "react";
import { SignUpFields } from "./signup-fields";
import { Stack } from "smarthr-ui";
import { Status } from "./status";
import { useAction } from "./action";
import { useState } from "react";

function SignUpForm(): ReactElement {
  const [sent, setSent] = useState(false);
  const action = useAction();
  return (
    <Stack>
      {sent ? (
        <Status>確認メールを送信しました。メールのリンクで確認後、ログインしてください。</Status>
      ) : (
        <SignUpFields action={action} onSent={setSent} />
      )}
      <ActionStatus action={action} pendingMessage="登録を処理しています。" />
    </Stack>
  );
}

export { SignUpForm };
