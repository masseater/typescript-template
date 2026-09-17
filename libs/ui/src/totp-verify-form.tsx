import type { ReactElement, SubmitEventHandler, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import { Button } from "./shared/ui";
import { TotpField } from "./totp-field";
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
      <div className="flex w-full max-w-md flex-col gap-4">
        <TotpField code={code} />
        <Button type="submit" disabled={action.blocked || !saved}>
          確認して認証アプリを有効化
        </Button>
      </div>
    </form>
  );
}

export { TotpVerifyForm };
