import { authClient } from "./client";
import { requireSuccess, type SessionView } from "./protocol";
import { Button } from "./shared/ui/button";
import { Field } from "./shared/ui/field";
import { FormColumn } from "./shared/ui/form-column";
import { useTextInput } from "./use-text-input";

import type { ReactElement, SyntheticEvent } from "react";
import type { Enrollment, SettingsContext } from "./mfa-types";

type TotpPasswordFormProps = {
  readonly context: SettingsContext;
  readonly enrolling: boolean;
  readonly onEnroll: (enrollment: Enrollment) => void;
};

const adminLocked = (session: SessionView, recovery: string | undefined): boolean => {
  return (
    session.user.role === "admin" &&
    (session.user.twoFactorEnabled || (recovery === "1" && !session.strong))
  );
};

const enrollTotp = async (password: string): Promise<Enrollment> => {
  const data = requireSuccess(await authClient.twoFactor.enable({ password }));
  if (data.method !== "totp") {
    throw new Error("サーバーで TOTP 登録が有効になっていません。");
  }
  return { backupCodes: data.backupCodes, totpURI: data.totpURI };
};

const TotpPasswordForm = ({
  context,
  enrolling,
  onEnroll,
}: TotpPasswordFormProps): ReactElement => {
  const { action, onNoticeClear, recovery, session } = context;
  const password = useTextInput();
  const submit = (event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    event.preventDefault();
    action.run(async () => {
      onNoticeClear();
      if (session.user.twoFactorEnabled) {
        requireSuccess(await authClient.twoFactor.disable({ password: password.value }));
        password.handleChange("");
        globalThis.location.assign(recovery === "1" ? "/login?recovery=setup" : "/login");
        return;
      }
      onEnroll(await enrollTotp(password.value));
      password.handleChange("");
    });
  };
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <FormColumn>
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={session.user.email}
          readOnly
          hidden
        />
        <Field
          label="設定変更を確認するパスワード"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password.value}
          onValueChange={password.handleChange}
        />
        <Button
          type="submit"
          disabled={action.blocked || enrolling || adminLocked(session, recovery)}
        >
          {session.user.twoFactorEnabled ? "認証アプリを解除" : "認証アプリの登録を開始"}
        </Button>
      </FormColumn>
    </form>
  );
};

export { TotpPasswordForm };
