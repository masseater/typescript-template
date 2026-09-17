import type { MouseEventHandler, ReactElement } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { Children } from "./types";
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "box-border inline-flex w-fit cursor-pointer shrink-0 items-center justify-center gap-1 rounded-md border text-center font-bold whitespace-nowrap transition-colors outline-none select-none focus-visible:focus-indicator disabled:cursor-not-allowed",
  {
    defaultVariants: { size: "medium", variant: "secondary" },
    variants: {
      size: {
        medium: "px-2 py-1.5 text-base leading-none",
        small: "p-1 text-sm leading-none",
      },
      variant: {
        danger:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover disabled:border-destructive/50 disabled:bg-destructive/50 disabled:text-destructive-foreground/50",
        primary:
          "border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover disabled:border-primary/50 disabled:bg-primary/50 disabled:text-primary-foreground/50",
        secondary:
          "border-border bg-card text-foreground hover:bg-card-hover disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground",
      },
    },
  },
);

function Button({
  "aria-label": ariaLabel,
  children,
  disabled,
  onClick,
  size,
  type,
  variant,
}: Children &
  Readonly<{
    "aria-label"?: string;
    disabled?: boolean;
    onClick?: MouseEventHandler;
    size?: "medium" | "small";
    type: "button" | "submit";
    variant?: "danger" | "primary" | "secondary";
  }>): ReactElement {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={buttonVariants({ size, variant })}
    >
      {children}
    </ButtonPrimitive>
  );
}

export { Button };
