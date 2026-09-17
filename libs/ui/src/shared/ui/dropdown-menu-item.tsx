import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { itemVariants } from "./dropdown-menu-item-variants";

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
