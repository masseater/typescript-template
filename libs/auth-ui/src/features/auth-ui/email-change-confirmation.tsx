import {
  ActionStatus,
  Button,
  FormColumn,
  STATUS_VARIANT,
  StatusMessage,
  localState,
  useAction,
} from "@repo/ui";
import { Effect } from "effect";

import { verifyEmailToken } from "./verify-email-token.ts";

import type { ReactElement } from "react";

const invalidLink =
  "確認リンクが無効か、有効期限が切れています。もう一度メールアドレスの変更を申請してください。";

const useConfirmed = localState(false);

const EmailChangeConfirmation = ({ retryHref }: Readonly<{ retryHref: string }>): ReactElement => {
  const action = useAction();
  const [confirmed, setConfirmed] = useConfirmed();
  if (confirmed) {
    return (
      <>
        <StatusMessage variant={STATUS_VARIANT.success}>
          {"メールアドレスを変更しました。次回からは新しいメールアドレスでログインしてください。"}
        </StatusMessage>
        <a href="/login">{"ログイン"}</a>
      </>
    );
  }
  const afterVerification = Effect.sync(() => {
    setConfirmed(true);
  });
  const confirm = (): void => {
    action.run(() =>
      Effect.runPromise(verifyEmailToken(invalidLink).pipe(Effect.andThen(afterVerification))),
    );
  };
  return (
    <FormColumn>
      <p>{"下のボタンを押すと、新しいメールアドレスへの変更が確定します。"}</p>
      <Button action={confirm} disabled={action.blocked} type="button" variant="primary">
        {"メールアドレスの変更を確定する"}
      </Button>
      <ActionStatus action={action} pendingMessage="新しいメールアドレスを確認しています。" />
      {action.error !== undefined && (
        <>
          <a href={retryHref}>{"メールアドレスの変更へ"}</a>
          <a href="/login">{"ログイン"}</a>
        </>
      )}
    </FormColumn>
  );
};

export { EmailChangeConfirmation };
