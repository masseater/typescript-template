import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import type { ReactElement } from "react";
import type { Children } from "./types";

const DropdownMenuTrigger = ({
  "aria-label": ariaLabel,
  children,
  disabled,
}: Children & Readonly<{ "aria-label": string; disabled?: boolean }>): ReactElement => {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      aria-label={ariaLabel}
      disabled={disabled}
      className="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground data-popup-open:bg-card-hover"
    >
      {children}
    </MenuPrimitive.Trigger>
  );
};

export { DropdownMenuTrigger };
