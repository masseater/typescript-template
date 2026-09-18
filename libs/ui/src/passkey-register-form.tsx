import type { ReactElement, SyntheticEvent } from "react";
import { requireSecureContext, requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { NameField } from "./name-field";
import { PasskeyName } from "./auth-input";
import type { SettingsContext } from "./mfa-types";
import type { TextFieldApi } from "./form";
import { authClient } from "./client";
import { formColumnClassName } from "./form";
import { useForm } from "@tanstack/react-form";

const REGISTERED_NOTICE =
  "パスキーを登録しました。強認証への切り替えにはパスキーでログインし直してください。";

function PasskeyRegisterForm({
  context,
  onRegistered,
}: Readonly<{ context: SettingsContext; onRegistered: () => Promise<void> }>): ReactElement {
  const { action, onNotice, onNoticeClear, recovery, session } = context;
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value }: Readonly<{ value: Readonly<{ name: string }> }>): void => {
      action.run(async () => {
        onNoticeClear();
        requireSecureContext();
        requireSuccess(await authClient.passkey.addPasskey({ createSession: false, ...value }));
        form.reset();
        onNotice(REGISTERED_NOTICE);
        await onRegistered();
      });
    },
    validators: { onSubmit: PasskeyName },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  const recoveringAdmin = session.user.role === "admin" && !session.strong && recovery === "1";
  return (
    <form onSubmit={submit} noValidate className={formColumnClassName}>
      <form.Field name="name">
        {(field: TextFieldApi): ReactElement => (
          <NameField field={field} label="パスキーの名前" name="passkey-name" />
        )}
      </form.Field>
      <Button type="submit" disabled={action.blocked || recoveringAdmin}>
        パスキーを登録
      </Button>
    </form>
  );
}

export { PasskeyRegisterForm };
