import { ActionStatus, FormColumn, TextLink, localState, useAction } from "@repo/ui";

import { CardPage } from "#shared/ui/index.ts";
import { SignUpFields } from "./signup-fields.tsx";

import type { ReactElement } from "react";

const useSent = localState(false);

function SignUpPage(): ReactElement {
  const [sent, setSent] = useSent();
  const action = useAction();
  function showSent(): void {
    setSent(true);
  }
  if (sent) {
    return (
      <CardPage title="確認メールを送りました">
        <p className="text-base leading-normal">
          メールのリンクを開いてメールアドレスの確認を済ませてから、ログインしてください。
        </p>
        <TextLink to="/login">ログインへ</TextLink>
      </CardPage>
    );
  }
  return (
    <CardPage title="新規登録">
      <FormColumn>
        <SignUpFields action={action} onSent={showSent} />
        <ActionStatus action={action} pendingMessage="登録を処理しています。" />
      </FormColumn>
      <p className="text-base leading-normal">
        アカウントをお持ちの方は<TextLink to="/login">ログイン</TextLink>
      </p>
    </CardPage>
  );
}

export { SignUpPage };
