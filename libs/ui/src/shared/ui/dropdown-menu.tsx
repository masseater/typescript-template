import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { useState, type ReactElement } from "react";

import { DropdownMenuClose } from "./dropdown-menu-close";

import type { Children } from "./types";

const DropdownMenu = ({ children }: Children): ReactElement => {
  const [open, setOpen] = useState(false);
  const close = (): void => {
    setOpen(false);
  };
  return (
    <MenuPrimitive.Root data-slot="dropdown-menu" open={open} onOpenChange={setOpen}>
      <DropdownMenuClose value={close}>{children}</DropdownMenuClose>
    </MenuPrimitive.Root>
  );
};

export { DropdownMenu };
