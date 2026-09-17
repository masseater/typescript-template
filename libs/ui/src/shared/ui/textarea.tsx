import type { ComponentProps } from "react";
import { cn } from "cn";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "box-border block field-sizing-content min-h-16 w-full rounded-md border border-input bg-card px-1 py-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground read-only:bg-muted focus-visible:focus-indicator disabled:pointer-events-none disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
