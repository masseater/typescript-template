import { PLACEMENT, Popover, TRIGGER_TYPE } from "baseui/popover";
import { useLayoutEffect, type ReactElement, type ReactNode } from "react";

import { localState } from "../../local-state";
import { DropdownMenuContext, useDropdownMenu } from "./dropdown-menu-context";

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

export { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger };
