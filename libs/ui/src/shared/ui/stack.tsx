import type { ComponentProps } from "react";
import { cn } from "cn";

function Stack({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="stack" className={cn("flex w-full flex-col gap-2", className)} {...props} />
  );
}

export { Stack };
