import { SignUpForm } from "@repo/auth-ui/signup";
import { TextLink } from "@repo/ui";
import { useState } from "react";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function SignUpPage(): ReactElement {
  const [sent, setSent] = useState(false);
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
      <SignUpForm onSent={showSent} />
      <p className="text-base leading-normal">
        アカウントをお持ちの方は<TextLink to="/login">ログイン</TextLink>
      </p>
    </CardPage>
  );
}

export { SignUpPage };
