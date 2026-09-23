import { AUTHENTICATION_METHOD, type StrongAuthenticationMethod } from "@repo/config";
import { ActionStatus, Field, FormColumn, useAction, useTextInput } from "@repo/ui";
import { Effect } from "effect";

import { authTask } from "./browser-http.ts";
import { authClient } from "./client";
import { requireSecureContext, requireSuccess, type SessionView } from "./protocol";
import { StrongAuthControls } from "./strong-auth-controls";
import { useNotice } from "./use-notice";

import type { ReactElement, SyntheticEvent } from "react";

const requestedNotice =
  "新しいメールアドレスに確認メールを送りました。届いたリンクを開くと変更が確定します。いまのメールアドレスにもお知らせを送りました。";

const stepUp = (method: StrongAuthenticationMethod, code: string): Effect.Effect<void> =>
  method === AUTHENTICATION_METHOD.passwordTotp
    ? authTask(() => authClient.twoFactor.verifyTotp({ code, trustDevice: false })).pipe(
        Effect.map(requireSuccess),
        Effect.asVoid,
      )
    : authTask(() => {
        requireSecureContext();
        return authClient.signIn.passkey();
      }).pipe(Effect.map(requireSuccess), Effect.asVoid);

const requestEmailChange = ({
  code,
  method,
  newEmail,
  showNotice,
}: {
  readonly code: { readonly value: string; readonly handleChange: (next: string) => void };
  readonly method: StrongAuthenticationMethod;
  readonly newEmail: { readonly value: string; readonly handleChange: (next: string) => void };
  readonly showNotice: (notice: string) => void;
}): Effect.Effect<void> =>
  Effect.gen(function* changeEmail() {
    if (newEmail.value === "") {
      return yield* Effect.die(new Error("新しいメールアドレスを入力してください。"));
    }
    yield* stepUp(method, code.value);
    requireSuccess(yield* authTask(() => authClient.changeEmail({ newEmail: newEmail.value })));
    newEmail.handleChange("");
    code.handleChange("");
    showNotice(requestedNotice);
  });

const EmailChangeForm = ({
  securityHref,
  session,
}: Readonly<{ securityHref: string; session: SessionView }>): ReactElement => {
  const newEmail = useTextInput();
  const code = useTextInput();
  const action = useAction();
  const { clearNotice, notice, showNotice } = useNotice();
  const confirmChange = (method: StrongAuthenticationMethod): void => {
    clearNotice();
    action.run(() => Effect.runPromise(requestEmailChange({ code, method, newEmail, showNotice })));
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
          required
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
