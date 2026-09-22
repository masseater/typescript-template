import { type ReactElement, type ReactNode } from "react";

import { localState } from "../../local-state";
import { DropdownMenuContext } from "./dropdown-menu-context";

import type { Children } from "./types";

const useMenuOpen = localState(false);
const useMenuPanel = localState<ReactNode>(null);

const DropdownMenu = ({ children }: Children): ReactElement => {
  const [isOpen, setIsOpen] = useMenuOpen();
  const [menuPanel, setMenuPanel] = useMenuPanel();
  return (
    <DropdownMenuContext
      value={{
        close: () => {
          setIsOpen(false);
        },
        isOpen,
        menuPanel,
        setIsOpen,
        setMenuPanel,
      }}
    >
      <div data-slot="dropdown-menu">{children}</div>
    </DropdownMenuContext>
  );
};

export { DropdownMenu };
