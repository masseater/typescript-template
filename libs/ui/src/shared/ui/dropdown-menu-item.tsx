import type { Children } from "./types";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import type { ReactElement } from "react";
import { cva } from "class-variance-authority";

const itemVariants = cva(
  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-base leading-tight outline-none select-none data-disabled:cursor-not-allowed data-disabled:text-disabled-foreground data-highlighted:bg-accent",
  {
    defaultVariants: { variant: "default" },
    variants: {
      variant: {
        default: "text-foreground",
        destructive: "text-destructive",
      },
    },
  },
);

function DropdownMenuItem({
  children,
  disabled,
  onClick,
  variant,
}: Children &
  Readonly<{
    disabled?: boolean;
    onClick: () => void;
    variant?: "default" | "destructive";
  }>): ReactElement {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      disabled={disabled}
      onClick={onClick}
      className={itemVariants({ variant })}
    >
      {children}
    </MenuPrimitive.Item>
  );
}

export { DropdownMenuItem };
