import { type ActionState, Button, FormColumn, useTextInput } from "@repo/ui";

import { authClient } from "./client";
import { requireSuccess } from "./protocol";
import { TotpField } from "./totp-field";

import type { ReactElement, SyntheticEvent } from "react";

const TotpVerifyForm = ({
  action,
  onVerified,
  saved,
}: {
  readonly action: ActionState;
  readonly saved: boolean;
  readonly onVerified: () => void;
}): ReactElement => {
  const code = useTextInput();
  const submit = (submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void => {
    submitEvent.preventDefault();
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
