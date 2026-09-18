import { AUTHENTICATION_METHOD, ROLE } from "@repo/config";

import { CHALLENGE_MODE } from "./challenge-modes.ts";

import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { Field } from "./shared/ui/field";
import { FormColumn } from "./shared/ui/form-column";
import { useTextInput } from "./use-text-input";

import type { ReactElement, SyntheticEvent } from "react";
import type { Enrollment, SettingsContext } from "./mfa-types";
import type { SessionView } from "./protocol";

interface TotpPasswordFormProps {
  readonly context: SettingsContext;
  readonly enrolling: boolean;
  readonly onEnroll: (enrollment: Enrollment) => void;
}

function adminLocked(session: SessionView, recovery: string | undefined): boolean {
  return (
    session.user.role === ROLE.administrator &&
    (session.user.twoFactorEnabled || (recovery === "1" && !session.strong))
  );
}

async function enrollTotp(password: string): Promise<Enrollment> {
  const data = requireSuccess(await authClient.twoFactor.enable({ password }));
  if (data.method !== CHALLENGE_MODE.totp) {
    throw new Error("サーバーで TOTP 登録が有効になっていません。");
  }
  return { backupCodes: data.backupCodes, totpURI: data.totpURI };
}

function TotpPasswordForm({ context, enrolling, onEnroll }: TotpPasswordFormProps): ReactElement {
  const { action, onNoticeClear, recovery, session } = context;
  const password = useTextInput();
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
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
  }
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
          name={AUTHENTICATION_METHOD.password}
          type={AUTHENTICATION_METHOD.password}
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
}

export { TotpPasswordForm };
