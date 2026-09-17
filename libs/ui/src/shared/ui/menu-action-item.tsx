import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { menuItemClassName } from "./menu-item-class";

type MenuActionItemProps = Children & Readonly<{ disabled?: boolean; onSelect: () => void }>;

function MenuActionItem({ children, disabled, onSelect }: MenuActionItemProps): ReactElement {
  return (
    <MenuPrimitive.Item
      data-slot="menu-action-item"
      disabled={disabled}
      onClick={onSelect}
      className={menuItemClassName}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export { MenuActionItem };
