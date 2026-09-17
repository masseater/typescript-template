import type { ComponentProps, ReactElement } from "react";
import { Input, Stack } from "smarthr-ui";
import { useId } from "react";

type FieldProps = Readonly<
  Pick<
    ComponentProps<typeof Input>,
    | "inputMode"
    | "maxLength"
    | "minLength"
    | "name"
    | "onChange"
    | "pattern"
    | "required"
    | "type"
    | "value"
  > & { autoComplete?: string; label: string }
>;

function Field({ label, ...props }: FieldProps): ReactElement {
  const id = useId();
  return (
    <Stack>
      <label htmlFor={id}>{label}</label>
      <Input {...props} id={id} />
    </Stack>
  );
}

export { Field };
