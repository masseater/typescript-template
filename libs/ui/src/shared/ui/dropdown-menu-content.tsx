import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import type { ReactElement } from "react";
import type { Children } from "./types";

function DropdownMenuContent({ children }: Children): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner className="z-50 outline-none" align="end" sideOffset={4}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className="flex min-w-40 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export { DropdownMenuContent };
