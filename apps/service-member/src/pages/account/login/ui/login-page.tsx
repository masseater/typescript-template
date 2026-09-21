import { LoginForm } from "@repo/auth-ui";
import { TextLink } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";
import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function LoginPage({ destination }: Readonly<{ destination: string }>): ReactElement {
  function enter(): void {
    globalThis.location.assign(destination);
  }
  return (
    <CardPage title={m.login_title()}>
      <LoginForm onAuthenticated={enter} />
      <p className="text-base leading-normal">
        {m.login_to_signup()}
        <TextLink to="/signup">{m.signup_link()}</TextLink>
      </p>
    </CardPage>
  );
}

export { LoginPage };
