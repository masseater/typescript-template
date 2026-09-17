import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import { Button } from "./shared/ui";
import { TotpField } from "./totp-field";
import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { useTextInput } from "./use-text-input";

interface TotpVerifyFormProps {
  readonly action: ActionState;
  readonly saved: boolean;
  readonly onVerified: () => void;
}

function TotpVerifyForm({ action, onVerified, saved }: TotpVerifyFormProps): ReactElement {
  const code = useTextInput();
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    action.run(async () => {
      if (!saved) {
        throw new Error("バックアップコードを保管してください。");
      }
      requireSuccess(
        await authClient.twoFactor.verifyTotp({ code: code.value, trustDevice: false }),
      );
      onVerified();
      code.setValue("");
      globalThis.location.assign("/");
    });
  }
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
