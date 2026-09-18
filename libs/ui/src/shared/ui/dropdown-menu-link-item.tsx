import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import { use } from "react";

import { DropdownMenuClose } from "./dropdown-menu-close";
import { itemVariants } from "./dropdown-menu-item-variants";

import type { ReactElement } from "react";
import type { Children } from "./types";

type DropdownMenuLinkItemProps = Children & Readonly<{ render: ReactElement }>;

const DropdownMenuLinkItem = ({ children, render }: DropdownMenuLinkItemProps): ReactElement => {
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
};

export { DropdownMenuLinkItem };
