import type { Children } from "./types";
import { DropdownMenuClose } from "./dropdown-menu-close";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { cn } from "cn";
import { itemVariants } from "./dropdown-menu-item-variants";
import { use } from "react";

type DropdownMenuLinkItemProps = Children & Readonly<{ render: ReactElement }>;

function DropdownMenuLinkItem({ children, render }: DropdownMenuLinkItemProps): ReactElement {
  const close = use(DropdownMenuClose);
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      render={render}
      onClick={close}
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

export { DropdownMenuLinkItem };
