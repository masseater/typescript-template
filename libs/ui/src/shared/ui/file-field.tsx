import { Field as FieldPrimitive } from "@base-ui/react/field";

import { controlClassName, fieldClassName, labelClassName } from "./control";

import type { ReactElement } from "react";

const FileField = ({
  accept,
  disabled,
  hint,
  label,
  name,
  onFileChange,
}: Readonly<{
  accept: string;
  disabled?: boolean;
  hint?: string;
  label: string;
  name: string;
  onFileChange: (file: File | undefined) => void;
}>): ReactElement => {
  const handleChange = (
    change: Readonly<{
      currentTarget: Readonly<{ files: Readonly<Pick<FileList, "item">> | null }>;
    }>,
  ): void => {
    onFileChange(change.currentTarget.files?.item(0) ?? undefined);
  };
  return (
    <FieldPrimitive.Root data-slot="field" className={fieldClassName}>
      <FieldPrimitive.Label className={labelClassName}>{label}</FieldPrimitive.Label>
      <FieldPrimitive.Control
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        className={`inline-block cursor-pointer leading-none file:mr-2 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:py-1 file:font-bold file:text-secondary-foreground ${controlClassName}`}
      />
      {hint !== undefined && (
        <FieldPrimitive.Description className="text-sm leading-normal text-muted-foreground">
          {hint}
        </FieldPrimitive.Description>
      )}
    </FieldPrimitive.Root>
  );
};

export { FileField };
