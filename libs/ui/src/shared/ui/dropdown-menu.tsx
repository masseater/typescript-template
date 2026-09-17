import { useCallback, useState } from "react";
import type { Children } from "./types";
import { DropdownMenuClose } from "./dropdown-menu-close";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";

function DropdownMenu({ children }: Children): ReactElement {
  const [open, setOpen] = useState(false);
  const close = useCallback((): void => {
    setOpen(false);
  }, []);
  return (
    <MenuPrimitive.Root data-slot="dropdown-menu" open={open} onOpenChange={setOpen}>
      <DropdownMenuClose value={close}>{children}</DropdownMenuClose>
    </MenuPrimitive.Root>
  );
}

export { DropdownMenu };
