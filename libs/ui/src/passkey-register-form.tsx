import { Button, Field } from "./shared/ui";
import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import { requireSecureContext, requireSuccess } from "./protocol";
import type { SettingsContext } from "./mfa-types";
import { authClient } from "./client";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface PasskeyRegisterFormProps {
  readonly context: SettingsContext;
  readonly onRegistered: () => Promise<void>;
}

const REGISTERED_NOTICE =
  "パスキーを登録しました。強認証への切り替えにはパスキーでログインし直してください。";

function PasskeyRegisterForm({ context, onRegistered }: PasskeyRegisterFormProps): ReactElement {
  const { action, onNotice, onNoticeClear, recovery, session } = context;
  const { run } = action;
  const name = useTextInput();
  const { setValue: setName, value: nameValue } = name;
  const submit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<Pick<SyntheticEvent, "preventDefault">>) => {
      event.preventDefault();
      run(async () => {
        onNoticeClear();
        requireSecureContext();
        requireSuccess(
          await authClient.passkey.addPasskey({ createSession: false, name: nameValue }),
        );
        setName("");
        onNotice(REGISTERED_NOTICE);
        await onRegistered();
      });
    },
    [nameValue, onNotice, onNoticeClear, onRegistered, run, setName],
  );
  const recoveringAdmin = session.user.role === "admin" && !session.strong && recovery === "1";
  return (
    <form onSubmit={submit}>
      <div className="flex w-full flex-col gap-4">
        <Field
          label="パスキーの名前"
          name="passkey-name"
          maxLength={100}
          required
          value={nameValue}
          onChange={name.handleChange}
        />
        <Button type="submit" disabled={action.blocked || recoveringAdmin}>
          パスキーを登録
        </Button>
      </div>
    </form>
  );
}

export { PasskeyRegisterForm };
