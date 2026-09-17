import { Field } from "./field";
import type { ReactElement } from "react";
import type { TextInput } from "./use-text-input";

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
    <Field
      label="認証アプリの確認コード"
      name="totp"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      minLength={6}
      maxLength={6}
      required
      value={code.value}
      onChange={code.handleChange}
    />
  );
}

export { ChallengeCodeField };
