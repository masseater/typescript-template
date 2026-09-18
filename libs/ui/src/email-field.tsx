import { FormTextField } from "./form-text-field";
import type { ReactElement } from "react";
import type { TextFieldApi } from "./form";

function EmailField({ field }: Readonly<{ field: TextFieldApi }>): ReactElement {
  return (
    <FormTextField
      field={field}
      label="メールアドレス"
      name="email"
      type="email"
      autoComplete="username"
      required
    />
  );
}

export { EmailField };
