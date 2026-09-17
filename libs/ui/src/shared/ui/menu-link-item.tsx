import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { menuItemClassName } from "./menu-item-class";

type MenuLinkItemProps = Children & Readonly<{ render: ReactElement }>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function MenuLinkItem({ children, render }: MenuLinkItemProps): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="menu-link-item"
      closeOnClick
      render={render}
      className={menuItemClassName}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

export { MenuLinkItem };
