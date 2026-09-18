import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type { ReactElement } from "react";

function Separator({ label }: Readonly<{ label: string }>): ReactElement {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      className="flex w-full items-center gap-2 text-sm leading-normal text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
    >
      {label}
    </SeparatorPrimitive>
  );
}

export { Separator };
