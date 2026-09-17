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

export { Field };
