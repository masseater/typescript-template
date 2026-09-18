import type { ReactElement, SyntheticEvent } from "react";
import { requireSecureContext, requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { Field } from "./shared/ui/field";
import { FormColumn } from "./shared/ui/form-column";
import type { SettingsContext } from "./mfa-types";
import { authClient } from "./client";
import { useTextInput } from "./use-text-input";

interface PasskeyRegisterFormProps {
  readonly context: SettingsContext;
  readonly onRegistered: () => void;
}

const REGISTERED_NOTICE =
  "パスキーを登録しました。強認証への切り替えにはパスキーでログインし直してください。";

function PasskeyRegisterForm({ context, onRegistered }: PasskeyRegisterFormProps): ReactElement {
  const { action, onNotice, onNoticeClear, recovery, session } = context;
  const name = useTextInput();
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    action.run(async () => {
      onNoticeClear();
      requireSecureContext();
      requireSuccess(
        await authClient.passkey.addPasskey({ createSession: false, name: name.value }),
      );
      name.handleChange("");
      onNotice(REGISTERED_NOTICE);
      onRegistered();
    });
  }
  const recoveringAdmin = session.user.role === "admin" && !session.strong && recovery === "1";
  return (
    <form onSubmit={submit}>
      <FormColumn>
        <Field
          label="パスキーの名前"
          name="passkey-name"
          maxLength={100}
          required
          value={name.value}
          onValueChange={name.handleChange}
        />
        <Button type="submit" disabled={action.blocked || recoveringAdmin}>
          パスキーを登録
        </Button>
      </FormColumn>
    </form>
  );
}

export { PasskeyRegisterForm };
