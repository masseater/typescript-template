import { FormTextField } from "./form-text-field";
import type { ReactElement } from "react";
import type { TextFieldApi } from "./form";
import { maximumNameLength } from "@template/runtime/contracts";

function NameField({
  autoComplete,
  field,
  label,
  name,
}: Readonly<{
  autoComplete?: "name" | undefined;
  field: TextFieldApi;
  label: string;
  name: string;
}>): ReactElement {
  return (
    <FormTextField
      field={field}
      label={label}
      name={name}
      autoComplete={autoComplete}
      required
      maxLength={maximumNameLength}
    />
  );
}

export { NameField };
