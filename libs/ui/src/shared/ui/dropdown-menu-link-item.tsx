import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { cn } from "cn";
import { itemVariants } from "./dropdown-menu-item-variants";

type DropdownMenuLinkItemProps = Children & Readonly<{ render: ReactElement }>;

function DropdownMenuLinkItem({ children, render }: DropdownMenuLinkItemProps): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      render={render}
      closeOnClick
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

export { DropdownMenuLinkItem };
