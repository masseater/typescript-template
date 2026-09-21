import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { createLink } from "@tanstack/react-router";
import { cn } from "cn";

import { itemVariants } from "./dropdown-menu-item-variants";

import type { ComponentProps, ReactElement } from "react";

const DropdownMenuLinkAnchor = ({
  children,
  ...anchor
}: Readonly<ComponentProps<"a">>): ReactElement => {
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      render={<a {...anchor} />}
      closeOnClick
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
};

const DropdownMenuLinkItem = createLink(DropdownMenuLinkAnchor);

export { DropdownMenuLinkItem };
