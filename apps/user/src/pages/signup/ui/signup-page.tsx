import { useCallback, useState } from "react";
import { CardPage } from "#shared/ui/index.ts";
import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { SignUpForm } from "@template/ui/signup";

function SignUpPage(): ReactElement {
  const [sent, setSent] = useState(false);
  const showSent = useCallback((): void => {
    setSent(true);
  }, []);
  if (sent) {
    return (
      <CardPage title="確認メールを送りました">
        <p className="text-base leading-normal">
          メールのリンクを開いてメールアドレスの確認を済ませてから、ログインしてください。
        </p>
        <Link to="/login">ログインへ</Link>
      </CardPage>
    );
  }
  return (
    <CardPage title="新規登録">
      <SignUpForm onSent={showSent} />
      <p className="text-base leading-normal">
        アカウントをお持ちの方は<Link to="/login">ログイン</Link>
      </p>
    </CardPage>
  );
}

export { SignUpPage };
