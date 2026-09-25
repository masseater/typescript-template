import { createContext, use } from "react";

type DropdownMenuContextValue = {
  readonly close: () => void;
  readonly open: boolean;
  readonly toggle: () => void;
  readonly triggerId: string;
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
export type { DropdownMenuContextValue };
