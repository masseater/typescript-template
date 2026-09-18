import type { Enrollment, SettingsContext } from "./mfa-types";
import type { ReactElement, SyntheticEvent } from "react";
import { Button } from "./shared/ui/button";
import { CurrentPassword } from "./auth-input";
import { PasswordField } from "./password-field";
import type { SessionView } from "./protocol";
import type { TextFieldApi } from "./form";
import { authClient } from "./client";
import { formColumnClassName } from "./form";
import { requireSuccess } from "./protocol";
import { useForm } from "@tanstack/react-form";

interface TotpPasswordFormProps {
  readonly context: SettingsContext;
  readonly enrolling: boolean;
  readonly onEnroll: (enrollment: Enrollment) => void;
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

async function changeTotp(password: string, props: TotpPasswordFormProps): Promise<void> {
  const { context, onEnroll } = props;
  context.onNoticeClear();
  if (context.session.user.twoFactorEnabled) {
    requireSuccess(await authClient.twoFactor.disable({ password }));
    globalThis.location.assign(context.recovery === "1" ? "/login?recovery=setup" : "/login");
    return;
  }
  onEnroll(await enrollTotp(password));
}

function TotpPasswordForm(props: TotpPasswordFormProps): ReactElement {
  const { context, enrolling } = props;
  const { action, recovery, session } = context;
  const form = useForm({
    defaultValues: { password: "" },
    onSubmit: ({ value }: Readonly<{ value: Readonly<{ password: string }> }>): void => {
      action.run(async () => {
        await changeTotp(value.password, props);
        form.reset();
      });
    },
    validators: { onSubmit: CurrentPassword },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate aria-busy={action.pending} className={formColumnClassName}>
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={session.user.email}
        readOnly
        hidden
      />
      <form.Field name="password">
        {(field: TextFieldApi): ReactElement => <PasswordField field={field} purpose="confirm" />}
      </form.Field>
      <Button
        type="submit"
        disabled={action.blocked || enrolling || adminLocked(session, recovery)}
      >
        {session.user.twoFactorEnabled ? "認証アプリを解除" : "認証アプリの登録を開始"}
      </Button>
    </form>
  );
}

export { TotpPasswordForm };
