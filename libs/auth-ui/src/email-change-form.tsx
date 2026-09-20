import { AUTHENTICATION_METHOD, type StrongAuthenticationMethod } from "@repo/config";
import { ActionStatus, Field, FormColumn, useAction, useTextInput } from "@repo/ui";
import { useState, type ReactElement, type SyntheticEvent } from "react";

import { authClient } from "./client";
import { requireSecureContext, requireSuccess, type SessionView } from "./protocol";
import { StrongAuthControls } from "./strong-auth-controls";

const requestedNotice =
  "新しいメールアドレスに確認メールを送りました。届いたリンクを開くと変更が確定します。いまのメールアドレスにもお知らせを送りました。";

const stepUp = async (method: StrongAuthenticationMethod, code: string): Promise<void> => {
  if (method === AUTHENTICATION_METHOD.passwordTotp) {
    requireSuccess(await authClient.twoFactor.verifyTotp({ code, trustDevice: false }));
    return;
  }
  requireSecureContext();
  requireSuccess(await authClient.signIn.passkey());
};

const EmailChangeForm = ({
  securityHref,
  session,
}: Readonly<{ securityHref: string; session: SessionView }>): ReactElement => {
  const newEmail = useTextInput();
  const code = useTextInput();
  const action = useAction();
  const [notice, setNotice] = useState<string>();
  const confirmChange = (method: StrongAuthenticationMethod): void => {
    setNotice(undefined);
    action.run(async () => {
      if (newEmail.value === "") {
        throw new Error("新しいメールアドレスを入力してください。");
      }
      await stepUp(method, code.value);
      requireSuccess(await authClient.changeEmail({ newEmail: newEmail.value }));
      newEmail.handleChange("");
      code.handleChange("");
      setNotice(requestedNotice);
    });
  };
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
    if (session.user.twoFactorEnabled) {
      confirmChange(AUTHENTICATION_METHOD.passwordTotp);
    }
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <Field
          label="現在のメールアドレス"
          name="current-email"
          type="email"
          readOnly
          value={session.user.email}
        />
        <Field
          label="新しいメールアドレス"
          name="new-email"
          type="email"
          value={newEmail.value}
          onValueChange={newEmail.handleChange}
        />
        <StrongAuthControls
          action={action}
          code={code}
          onConfirm={confirmChange}
          securityHref={securityHref}
          session={session}
        />
        <ActionStatus
          action={action}
          notice={notice}
          pendingMessage="メールアドレスの変更を申請しています。"
        />
      </FormColumn>
    </form>
  );
};

export { EmailChangeForm };
