import { FormTextField } from "./form-text-field";
import type { ReactElement } from "react";
import type { TextFieldApi } from "./form";
import { TotpField } from "./totp-field";

function ChallengeCodeField({
  backup,
  field,
}: Readonly<{ backup: boolean; field: TextFieldApi }>): ReactElement {
  return backup ? (
    <FormTextField
      field={field}
      label="バックアップコード"
      name="backup-code"
      type="password"
      autoComplete="off"
      required
    />
  ) : (
    <TotpField field={field} />
  );
}

export { ChallengeCodeField };
