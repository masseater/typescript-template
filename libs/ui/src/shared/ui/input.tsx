import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

function Input({ className, ...props }: InputPrimitive.Props) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "box-border inline-block w-full rounded-md border border-input bg-card px-1 py-1.5 text-base leading-none text-foreground outline-none placeholder:text-muted-foreground read-only:bg-muted focus-visible:focus-indicator disabled:pointer-events-none disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
