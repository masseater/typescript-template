import { useDropdownMenu } from "./dropdown-menu-context";

import type { ReactElement } from "react";
import type { Children } from "./types";

const DropdownMenuTrigger = ({
  "aria-label": ariaLabel,
  children,
  disabled = false,
}: Children & Readonly<{ "aria-label": string; disabled?: boolean }>): ReactElement => {
  const { open, toggle, triggerId } = useDropdownMenu();
  return (
    <button
      type="button"
      id={triggerId}
      data-slot="dropdown-menu-trigger"
      aria-label={ariaLabel}
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={disabled}
      className="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground"
      onClick={toggle}
    >
      {children}
    </button>
  );
};

export { DropdownMenuTrigger };
