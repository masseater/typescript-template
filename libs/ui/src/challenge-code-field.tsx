import { Field } from "./shared/ui";
import type { ReactElement } from "react";
import type { TextInput } from "./use-text-input";
import { TotpField } from "./totp-field";

function ChallengeCodeField({
  backup,
  code,
}: Readonly<{ backup: boolean; code: TextInput }>): ReactElement {
  return backup ? (
    <Field
      label="バックアップコード"
      name="backup-code"
      type="password"
      autoComplete="off"
      required
      value={code.value}
      onChange={code.handleChange}
    />
  ) : (
    <TotpField code={code} />
  );
}

export { ChallengeCodeField };
