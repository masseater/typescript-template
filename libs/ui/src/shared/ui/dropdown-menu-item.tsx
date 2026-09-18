import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { itemVariants } from "./dropdown-menu-item-variants";

import type { ReactElement } from "react";
import type { Children } from "./types";

function DropdownMenuItem({
  children,
  disabled,
  onClick,
  variant,
}: Children &
  Readonly<{
    disabled?: boolean;
    onClick: () => void;
    variant?: "default" | "destructive";
  }>): ReactElement {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      disabled={disabled}
      onClick={onClick}
      className={itemVariants({ variant })}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export { DropdownMenuItem };
