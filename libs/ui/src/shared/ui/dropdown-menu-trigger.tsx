import { PLACEMENT, Popover, TRIGGER_TYPE } from "baseui/popover";

import { useDropdownMenu } from "./dropdown-menu-context";

import type { ReactElement } from "react";
import type { Children } from "./types";

const DropdownMenuTrigger = ({
  "aria-label": ariaLabel,
  children,
  disabled = false,
}: Children & Readonly<{ "aria-label": string; disabled?: boolean }>): ReactElement => {
  const { menuPanel, isOpen, setIsOpen } = useDropdownMenu();
  return (
    <Popover
      accessibilityType="menu"
      ignoreBoundary
      isOpen={isOpen}
      placement={PLACEMENT.bottomRight}
      popoverMargin={4}
      triggerType={TRIGGER_TYPE.click}
      content={() => menuPanel}
      onClick={() => {
        if (disabled) {
          return;
        }
        setIsOpen((open) => !open);
      }}
      onClickOutside={() => {
        setIsOpen(false);
      }}
      onEsc={() => {
        setIsOpen(false);
      }}
    >
      <button
        type="button"
        data-slot="dropdown-menu-trigger"
        aria-label={ariaLabel}
        disabled={disabled}
        className="box-border inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-transparent p-1 text-base leading-none text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator disabled:cursor-not-allowed disabled:text-disabled-foreground"
      >
        {children}
      </button>
    </Popover>
  );
};

export { DropdownMenuTrigger };
