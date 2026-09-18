import type { ReactElement, SyntheticEvent } from "react";
import type { ActionState } from "./action";
import { Button } from "./shared/ui/button";
import type { TextFieldApi } from "./form";
import { TotpCode } from "./auth-input";
import { TotpField } from "./totp-field";
import { authClient } from "./client";
import { formColumnClassName } from "./form";
import { requireSuccess } from "./protocol";
import { useForm } from "@tanstack/react-form";

function TotpVerifyForm({
  action,
  onVerified,
  saved,
}: Readonly<{ action: ActionState; onVerified: () => void; saved: boolean }>): ReactElement {
  const form = useForm({
    defaultValues: { code: "" },
    onSubmit: ({ value }: Readonly<{ value: Readonly<{ code: string }> }>): void => {
      action.run(async () => {
        if (!saved) {
          throw new Error("バックアップコードを保管してください。");
        }
        requireSuccess(await authClient.twoFactor.verifyTotp({ ...value, trustDevice: false }));
        onVerified();
        form.reset();
        globalThis.location.assign("/");
      });
    },
    validators: { onSubmit: TotpCode },
  });
  function submit(event: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    event.preventDefault();
    void form.handleSubmit();
  }
  return (
    <form onSubmit={submit} noValidate className={formColumnClassName}>
      <form.Field name="code">
        {(field: TextFieldApi): ReactElement => <TotpField field={field} />}
      </form.Field>
      <Button type="submit" disabled={action.blocked || !saved}>
        確認して認証アプリを有効化
      </Button>
    </form>
  );
}

export { TotpVerifyForm };
