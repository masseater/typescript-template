import { ActionStatus, Button, FormColumn, useAction } from "@repo/ui";
import { Effect } from "effect";

import { verifyEmailToken } from "./verify-email-token.ts";

import type { ReactElement } from "react";

const invalidLink =
  "確認リンクが無効か、有効期限が切れています。ログインして確認メールを再送してください。";

const afterVerification = Effect.sync(() => {
  globalThis.location.replace("/login");
});

const EmailVerification = (): ReactElement => {
  const action = useAction();
  const confirm = (): void => {
    action.run(() =>
      Effect.runPromise(verifyEmailToken(invalidLink).pipe(Effect.andThen(afterVerification))),
    );
  };
  return (
    <FormColumn>
      <p>{"下のボタンを押すと、このメールアドレスの確認が済みます。"}</p>
      <Button action={confirm} disabled={action.blocked} type="button" variant="primary">
        {"メールアドレスを確認する"}
      </Button>
      <ActionStatus action={action} pendingMessage="メールアドレスを確認しています。" />
    </FormColumn>
  );
};

export { EmailVerification };
