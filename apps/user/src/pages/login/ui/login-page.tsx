import { TextLink } from "@template/ui";
import { LoginForm } from "@template/ui/auth";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

const LoginPage = ({ destination }: Readonly<{ destination: string }>): ReactElement => {
  const enter = (): void => {
    globalThis.location.assign(destination);
  };
  return (
    <CardPage title="ログイン">
      <LoginForm onAuthenticated={enter} />
      <p className="text-base leading-normal">
        アカウントをお持ちでない方は<TextLink to="/signup">新規登録</TextLink>
      </p>
    </CardPage>
  );
};

export { LoginPage };
