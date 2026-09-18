import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { createLink } from "@tanstack/react-router";
import { cn } from "cn";
import { use } from "react";

import { DropdownMenuClose } from "./dropdown-menu-close";
import { itemVariants } from "./dropdown-menu-item-variants";

import type { ComponentProps, ReactElement } from "react";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function DropdownMenuLinkAnchor({
  children,
  ...anchor
}: Readonly<ComponentProps<"a">>): ReactElement {
  const close = use(DropdownMenuClose);
  return (
    <MenuPrimitive.LinkItem
      data-slot="dropdown-menu-link-item"
      // oxlint-disable-next-line react/jsx-props-no-spreading
      render={<a {...anchor} />}
      onClick={close}
      className={cn(itemVariants(), "no-underline hover:text-foreground")}
    >
      {children}
    </MenuPrimitive.LinkItem>
  );
}

const DropdownMenuLinkItem = createLink(DropdownMenuLinkAnchor);

export { DropdownMenuLinkItem };
