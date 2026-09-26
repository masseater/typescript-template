import { PLACEMENT, Popover } from "baseui/popover";

import { useDropdownMenu } from "./dropdown-menu-context";

import type { ReactElement } from "react";
import type { Children } from "./types";

const DropdownMenuContent = ({ children }: Children): ReactElement => {
  const { close, open, triggerId } = useDropdownMenu();
  return (
    <Popover
      accessibilityType="menu"
      ignoreBoundary
      isOpen={open}
      placement={PLACEMENT.bottomRight}
      popoverMargin={4}
      content={
        <div
          role="menu"
          aria-labelledby={triggerId}
          data-slot="dropdown-menu-content"
          className="flex min-w-40 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        >
          {children}
        </div>
      }
      onClickOutside={(click) => {
        const trigger = globalThis.document.getElementById(triggerId);
        if (click.target instanceof Node && trigger?.contains(click.target) === true) {
          return;
        }
        close();
      }}
      onEsc={close}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0" />
    </Popover>
  );
};

export { DropdownMenuContent };
