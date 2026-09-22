import { FormControl } from "baseui/form-control";

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
  const selectFile = (
    change: Readonly<{
      currentTarget: Readonly<{ files: Readonly<Pick<FileList, "item">> | null }>;
    }>,
  ): void => {
    onFileChange(change.currentTarget.files?.item(0) ?? undefined);
  };
  return (
    <div data-slot="field" className={fieldClassName}>
      <FormControl
        label={<span className={labelClassName}>{label}</span>}
        caption={hint ?? null}
      >
        <input
          aria-label={label}
          type="file"
          name={name}
          accept={accept}
          disabled={disabled}
          onChange={selectFile}
          className={`inline-block cursor-pointer leading-none file:mr-2 file:rounded-sm file:border-0 file:bg-secondary file:px-2 file:py-1 file:font-bold file:text-secondary-foreground ${controlClassName}`}
        />
      </FormControl>
    </div>
  );
};

export { FileField };
