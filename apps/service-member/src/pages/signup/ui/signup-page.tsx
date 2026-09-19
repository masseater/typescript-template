import { StatusMessage, STATUS_VARIANT, TextLink, useAction } from "@repo/ui";
import { useState } from "react";

import { CardPage } from "#shared/ui/index.ts";
import { SignUpFields } from "./signup-fields.tsx";

import type { ReactElement } from "react";

function SignUpPage(): ReactElement {
  const [sent, setSent] = useState(false);
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
      <SignUpFields action={action} onSent={showSent} />
      {action.pending ? (
        <StatusMessage variant={STATUS_VARIANT.pending}>登録を処理しています。</StatusMessage>
      ) : null}
      {action.error !== undefined ? (
        <StatusMessage variant={STATUS_VARIANT.failure}>{action.error}</StatusMessage>
      ) : null}
      <p className="text-base leading-normal">
        アカウントをお持ちの方は<TextLink to="/login">ログイン</TextLink>
      </p>
    </CardPage>
  );
}

export { SignUpPage };
