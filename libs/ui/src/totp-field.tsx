import { totpInputPattern, totpLength } from "./auth-input";
import { FormTextField } from "./form-text-field";
import type { ReactElement } from "react";
import type { TextFieldApi } from "./form";

function TotpField({ field }: Readonly<{ field: TextFieldApi }>): ReactElement {
  return (
    <FormTextField
      field={field}
      label="認証アプリの確認コード"
      name="totp"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={totpInputPattern}
      minLength={totpLength}
      maxLength={totpLength}
      required
    />
  );
}

export { TotpField };
