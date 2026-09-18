import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { Button } from "./shared/ui/button";
import { FormColumn } from "./shared/ui/form-column";
import { TotpField } from "./totp-field";
import { useTextInput } from "./use-text-input";

import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";

type TotpVerifyFormProps = {
  readonly action: ActionState;
  readonly saved: boolean;
  readonly onVerified: () => void;
};

const TotpVerifyForm = ({ action, onVerified, saved }: TotpVerifyFormProps): ReactElement => {
  const code = useTextInput();
  const submit = (event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    event.preventDefault();
    action.run(async () => {
      if (!saved) {
        throw new Error("バックアップコードを保管してください。");
      }
      requireSuccess(
        await authClient.twoFactor.verifyTotp({ code: code.value, trustDevice: false }),
      );
      onVerified();
      code.handleChange("");
      globalThis.location.assign("/");
    });
  };
  return (
    <form onSubmit={submit}>
      <FormColumn>
        <TotpField code={code} />
        <Button type="submit" disabled={action.blocked || !saved}>
          確認して認証アプリを有効化
        </Button>
      </FormColumn>
    </form>
  );
};

export { TotpVerifyForm };
