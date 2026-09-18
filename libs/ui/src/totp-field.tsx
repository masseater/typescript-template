import { Field } from "./shared/ui/field";
import type { ReactElement } from "react";
import type { TextInput } from "./use-text-input";

const TOTP_LENGTH = 6;

function TotpField({ code }: Readonly<{ code: TextInput }>): ReactElement {
  return (
    <Field
      label="認証アプリの確認コード"
      name="totp"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      minLength={TOTP_LENGTH}
      maxLength={TOTP_LENGTH}
      required
      value={code.value}
      onValueChange={code.handleChange}
    />
  );
}

export { TotpField };
