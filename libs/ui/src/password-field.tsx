import { maximumPasswordLength, minimumPasswordLength } from "@template/config";
import { FormTextField } from "./form-text-field";
import type { ReactElement } from "react";
import type { TextFieldApi } from "./form";

type Purpose = "confirm" | "current" | "new";

const purposes = {
  confirm: { autoComplete: "current-password", label: "設定変更を確認するパスワード" },
  current: { autoComplete: "current-password", label: "パスワード" },
  new: {
    autoComplete: "new-password",
    label: `パスワード（${minimumPasswordLength}文字以上）`,
    maxLength: maximumPasswordLength,
    minLength: minimumPasswordLength,
  },
} as const satisfies Readonly<
  Record<
    Purpose,
    Readonly<{
      autoComplete: "current-password" | "new-password";
      label: string;
      maxLength?: number;
      minLength?: number;
    }>
  >
>;

function PasswordField({
  field,
  purpose,
}: Readonly<{ field: TextFieldApi; purpose: Purpose }>): ReactElement {
  const { autoComplete, label } = purposes[purpose];
  const limits = purposes.new;
  return (
    <FormTextField
      field={field}
      label={label}
      name="password"
      type="password"
      autoComplete={autoComplete}
      required
      minLength={purpose === "new" ? limits.minLength : undefined}
      maxLength={purpose === "new" ? limits.maxLength : undefined}
    />
  );
}

export { PasswordField };
