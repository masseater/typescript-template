import { LoginForm } from "@repo/auth-ui";
import { TextLink } from "@repo/ui";

import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function LoginPage({ destination }: Readonly<{ destination: string }>): ReactElement {
  function enter(): void {
    globalThis.location.assign(destination);
  }
  return (
    <CardPage title="ログイン">
      <LoginForm onAuthenticated={enter} />
      <p className="text-base leading-normal">
        アカウントをお持ちでない方は<TextLink to="/signup">新規登録</TextLink>
      </p>
    </CardPage>
  );
}

export { LoginPage };
