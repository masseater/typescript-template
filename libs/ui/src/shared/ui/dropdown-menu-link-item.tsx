import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { cn } from "cn";
import { itemVariants } from "./dropdown-menu-item-variants";

type DropdownMenuLinkItemProps = Children & Readonly<{ render: ReactElement }>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function DropdownMenuLinkItem({ children, render }: DropdownMenuLinkItemProps): ReactElement {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      closeOnClick
      render={render}
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

export { DropdownMenuLinkItem };
