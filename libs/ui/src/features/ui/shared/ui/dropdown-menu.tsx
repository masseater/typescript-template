import { useId, type ReactElement } from "react";

import { localState } from "../../local-state";
import { DropdownMenuContext } from "./dropdown-menu-context";

import type { Children } from "./types";

const useMenuOpen = localState(false);

const DropdownMenu = ({ children }: Children): ReactElement => {
  const [open, setOpen] = useMenuOpen();
  const triggerId = useId();
  return (
    <DropdownMenuContext
      value={{
        close: () => {
          setOpen(false);
        },
        open,
        toggle: () => {
          setOpen((wasOpen) => !wasOpen);
        },
        triggerId,
      }}
    >
      <div data-slot="dropdown-menu" className="relative inline-flex">
        {children}
      </div>
    </DropdownMenuContext>
  );
};

export { DropdownMenu };
