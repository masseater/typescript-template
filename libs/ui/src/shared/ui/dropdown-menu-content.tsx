import { useLayoutEffect } from "react";

import { useDropdownMenu } from "./dropdown-menu-context";

import type { Children } from "./types";

const DropdownMenuContent = ({ children }: Children): null => {
  const { setMenuPanel } = useDropdownMenu();
  useLayoutEffect(() => {
    setMenuPanel(
      <div
        data-slot="dropdown-menu-content"
        className="flex min-w-40 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
      >
        {children}
      </div>,
    );
    return (): void => {
      setMenuPanel(null);
    };
  }, [children, setMenuPanel]);
  return null;
};

export { DropdownMenuContent };
