import type { ComponentProps } from "react";
import { useId } from "react";
import { cn } from "cn";
import { Input } from "./input";
import { Label } from "./label";

function Field({
  label,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "id"> & { label: string }) {
  const id = useId();
  return (
    <div data-slot="field" className={cn("flex w-full flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input {...props} id={id} />
    </div>
  );
}

function TotpField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field
      label="認証アプリの確認コード"
      name="totp"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      minLength={6}
      maxLength={6}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export { Field, TotpField };
