import { Button, Stack } from "smarthr-ui";
import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import { Field } from "./field";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useCallback } from "react";
import { useTextInput } from "./use-text-input";

interface TotpVerifyFormProps {
  readonly action: ActionState;
  readonly saved: boolean;
  readonly onVerified: () => void;
}

function TotpVerifyForm({ action, onVerified, saved }: TotpVerifyFormProps): ReactElement {
  const { run } = action;
  const code = useTextInput();
  const { setValue: setCode, value: codeValue } = code;
  const submit = useCallback<SubmitEventHandler<HTMLFormElement>>(
    (event: Readonly<Pick<SyntheticEvent, "preventDefault">>) => {
      event.preventDefault();
      run(async () => {
        if (!saved) {
          throw new Error("バックアップコードを保管してください。");
        }
        requireSuccess(
          await authClient.twoFactor.verifyTotp({ code: codeValue, trustDevice: false }),
        );
        onVerified();
        setCode("");
        globalThis.location.assign("/");
      });
    },
    [codeValue, onVerified, run, saved, setCode],
  );
  return (
    <form onSubmit={submit}>
      <Stack>
        <Field
          label="認証アプリの確認コード"
          name="totp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          value={codeValue}
          onChange={code.handleChange}
        />
        <Button type="submit" disabled={action.blocked || !saved}>
          確認して認証アプリを有効化
        </Button>
      </Stack>
    </form>
  );
}

export { TotpVerifyForm };
