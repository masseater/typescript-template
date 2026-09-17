import { Button, Stack } from "smarthr-ui";
import type { ReactElement, SubmitEventHandler } from "react";
import { Field } from "./field";
import type { SettingsContext } from "./mfa-types";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
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
    (event) => {
      event.preventDefault();
      run(async () => {
        onNoticeClear();
        if (!globalThis.isSecureContext) {
          throw new Error("パスキーには HTTPS または localhost が必要です。");
        }
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
      <Stack>
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
      </Stack>
    </form>
  );
}

export { PasskeyRegisterForm };
