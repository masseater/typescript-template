import type { ComponentProps } from "react";
import { cn } from "cn";
import { Loader2Icon } from "lucide-react";

function Spinner({ className, ...props }: ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      aria-hidden="true"
      className={cn("size-4 shrink-0 animate-spin text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Spinner };
