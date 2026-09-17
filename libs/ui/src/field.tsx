import type { ComponentProps, ReactElement } from "react";
import { Input, Stack } from "smarthr-ui";
import { useId } from "react";

type FieldProps = Omit<ComponentProps<typeof Input>, "id"> & { readonly label: string };

function Field({ label, ...props }: Readonly<FieldProps>): ReactElement {
  const id = useId();
  return (
    <Stack>
      <label htmlFor={id}>{label}</label>
      <Input {...props} id={id} />
    </Stack>
  );
}

export { Field };
