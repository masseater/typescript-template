import { createContext, use, type ReactElement, type ReactNode } from "react";

type DropdownMenuContextValue = {
  readonly close: () => void;
  readonly menuPanel: ReactNode;
  readonly isOpen: boolean;
  readonly setMenuPanel: (next: null | ReactElement) => void;
  readonly setIsOpen: (next: boolean | ((current: boolean) => boolean)) => void;
};

const DropdownMenuContext = createContext<DropdownMenuContextValue | undefined>(undefined);

const useDropdownMenu = (): DropdownMenuContextValue => {
  const menuContext = use(DropdownMenuContext);
  if (menuContext === undefined) {
    throw new Error("Dropdown menu parts must render inside DropdownMenu.");
  }
  return menuContext;
};

export { DropdownMenuContext, useDropdownMenu };
