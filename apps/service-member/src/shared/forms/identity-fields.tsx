import { Field } from "@repo/ui";

import { fieldError } from "./field-error.ts";

import type { ReactElement } from "react";

interface BoundTextField {
  readonly handleChange: (value: string) => void;
  readonly state: Readonly<{ meta: Readonly<{ errors: readonly unknown[] }>; value: string }>;
}

function NameField({
  field,
  label,
  maxLength,
}: Readonly<{ field: BoundTextField; label: string; maxLength: number }>): ReactElement {
  return (
    <Field
      label={label}
      name="name"
      autoComplete="name"
      maxLength={maxLength}
      value={field.state.value}
      onValueChange={field.handleChange}
      error={fieldError(field.state.meta.errors)}
    />
  );
}

function EmailField({ field }: Readonly<{ field: BoundTextField }>): ReactElement {
  return (
    <Field
      label="メールアドレス"
      name="email"
      type="email"
      autoComplete="username"
      value={field.state.value}
      onValueChange={field.handleChange}
      error={fieldError(field.state.meta.errors)}
    />
  );
}

export { EmailField, NameField };
export type { BoundTextField };
