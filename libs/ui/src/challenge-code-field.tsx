import { Field } from "./shared/ui/field";
import { TotpField } from "./totp-field";

import type { ReactElement } from "react";
import type { TextInput } from "./use-text-input";

const ChallengeCodeField = ({
  backup,
  code,
}: Readonly<{ backup: boolean; code: TextInput }>): ReactElement => {
  return backup ? (
    <Field
      label="バックアップコード"
      name="backup-code"
      type="password"
      autoComplete="off"
      required
      value={code.value}
      onValueChange={code.handleChange}
    />
  ) : (
    <TotpField code={code} />
  );
};

export { ChallengeCodeField };
