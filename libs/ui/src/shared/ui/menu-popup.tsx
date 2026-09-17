import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";

const sideOffset = 4;

function MenuPopup({
  align,
  children,
}: Children & Readonly<{ align: "end" | "start" }>): ReactElement {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <MenuPrimitive.Popup
          data-slot="menu"
          className="flex min-w-48 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none"
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export { MenuPopup };
