import type { Children } from "./types";
import type { ReactElement } from "react";

function DropdownMenuLabel({ children }: Children): ReactElement {
  return (
    <div
      data-slot="dropdown-menu-label"
      className="px-2 py-1.5 text-sm leading-tight text-muted-foreground"
    >
      {children}
    </div>
  );
}

export { DropdownMenuLabel };
