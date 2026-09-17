import { Button, Stack } from "smarthr-ui";
import type { Enrollment, SettingsContext } from "./mfa-types";
import type { ReactElement, SubmitEventHandler } from "react";
import { Field } from "./field";
import type { SessionView } from "./protocol";
import type { TextInput } from "./use-text-input";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface TotpPasswordFormProps {
  readonly context: SettingsContext;
  readonly enrolling: boolean;
  readonly onEnroll: (enrollment: Enrollment) => void;
}

interface TotpPasswordSubmit {
  readonly context: SettingsContext;
  readonly onEnroll: (enrollment: Enrollment) => void;
  readonly password: TextInput;
}

function adminLocked(session: SessionView, recovery: string | undefined): boolean {
  return (
    session.user.role === "admin" &&
    (session.user.twoFactorEnabled || (recovery === "1" && !session.strong))
  );
}

async function enrollTotp(password: string): Promise<Enrollment> {
  const data = requireSuccess(await authClient.twoFactor.enable({ password }));
  if (data.method !== "totp") {
    throw new Error("サーバーで TOTP 登録が有効になっていません。");
  }
  return { backupCodes: data.backupCodes, totpURI: data.totpURI };
}

function useTotpPasswordSubmit({
  context,
  onEnroll,
  password,
}: TotpPasswordSubmit): SubmitEventHandler<HTMLFormElement> {
  const { action, onNoticeClear, recovery, session } = context;
  const { run } = action;
  const { setValue: setPassword, value: passwordValue } = password;
  const { twoFactorEnabled } = session.user;
  return useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();
      run(async () => {
        onNoticeClear();
        if (twoFactorEnabled) {
          requireSuccess(await authClient.twoFactor.disable({ password: passwordValue }));
          setPassword("");
          globalThis.location.assign(recovery === "1" ? "/login?recovery=setup" : "/login");
          return;
        }
        onEnroll(await enrollTotp(passwordValue));
        setPassword("");
      });
    },
    [onEnroll, onNoticeClear, passwordValue, recovery, run, setPassword, twoFactorEnabled],
  );
}

function TotpPasswordForm({ context, enrolling, onEnroll }: TotpPasswordFormProps): ReactElement {
  const { action, recovery, session } = context;
  const password = useTextInput();
  const submit = useTotpPasswordSubmit({ context, onEnroll, password });
  return (
    <form onSubmit={submit} aria-busy={action.pending}>
      <Stack>
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
          onChange={password.handleChange}
        />
        <Button
          type="submit"
          disabled={action.blocked || enrolling || adminLocked(session, recovery)}
        >
          {session.user.twoFactorEnabled ? "認証アプリを解除" : "認証アプリの登録を開始"}
        </Button>
      </Stack>
    </form>
  );
}

export { TotpPasswordForm };
