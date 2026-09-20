import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { createLink } from "@tanstack/react-router";
import { cn } from "cn";
import { use, type ComponentProps, type ReactElement } from "react";

import { DropdownMenuClose } from "./dropdown-menu-close";
import { itemVariants } from "./dropdown-menu-item-variants";

const DropdownMenuLinkAnchor = ({
  children,
  ...anchor
}: Readonly<ComponentProps<"a">>): ReactElement => {
  const close = use(DropdownMenuClose);
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      render={<a {...anchor} />}
      onClick={close}
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
};

const DropdownMenuLinkItem = createLink(DropdownMenuLinkAnchor);

export { DropdownMenuLinkItem };
