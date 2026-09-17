import type { ComponentProps } from "react";
import { cn } from "cn";

function Label({ className, ...props }: ComponentProps<"label"> & { htmlFor: string }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "inline-flex items-center gap-1 text-base leading-tight font-bold text-foreground select-none",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
