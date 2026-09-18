import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";

function DropdownMenu({ children }: Children): ReactElement {
  return <MenuPrimitive.Root data-slot="dropdown-menu">{children}</MenuPrimitive.Root>;
}

export { DropdownMenu };
