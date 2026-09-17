import { CardPage } from "#shared/ui/index.ts";
import { Link } from "@tanstack/react-router";
import { LoginForm } from "@template/ui/auth";
import type { ReactElement } from "react";
import { useCallback } from "react";

function LoginPage({ destination }: Readonly<{ destination: string }>): ReactElement {
  const enter = useCallback((): void => {
    globalThis.location.assign(destination);
  }, [destination]);
  return (
    <CardPage title="ログイン">
      <LoginForm onAuthenticated={enter} />
      <p className="text-base leading-normal">
        アカウントをお持ちでない方は<Link to="/signup">新規登録</Link>
      </p>
    </CardPage>
  );
}

export { LoginPage };
