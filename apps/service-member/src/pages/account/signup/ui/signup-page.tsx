import { ActionStatus, FormColumn, TextLink, localState, useAction } from "@repo/ui";

import { m } from "#shared/i18n/index.ts";
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
      <CardPage title={m.signup_sent_title()}>
        <p className="text-base leading-normal">{m.signup_sent_body()}</p>
        <TextLink to="/login">{m.signup_sent_login()}</TextLink>
      </CardPage>
    );
  }
  return (
    <CardPage title={m.signup_title()}>
      <FormColumn>
        <SignUpFields action={action} onSent={showSent} />
        <ActionStatus action={action} pendingMessage={m.signup_pending()} />
      </FormColumn>
      <p className="text-base leading-normal">
        {m.signup_to_login()}
        <TextLink to="/login">{m.login_link()}</TextLink>
      </p>
    </CardPage>
  );
}

export { SignUpPage };
