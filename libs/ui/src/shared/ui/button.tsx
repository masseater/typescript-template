import type { MouseEventHandler, ReactElement } from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { Children } from "./types";
import { buttonVariants } from "./button-variants";

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
