import { type TextInput, Field } from "@repo/ui";

import { TotpField } from "./totp-field";

import type { ReactElement } from "react";

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
