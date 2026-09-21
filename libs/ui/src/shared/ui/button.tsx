import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { startTransition } from "react";

import { buttonVariants } from "./button-variants";

import type { MouseEventHandler, ReactElement } from "react";
import type { Children } from "./types";

type ButtonAction = () => void | Promise<void>;

const Button = ({
  "aria-label": ariaLabel,
  action,
  children,
  disabled,
  onClick,
  size,
  type,
  variant,
}: Children &
  Readonly<{
    "aria-label"?: string;
    action?: ButtonAction;
    disabled?: boolean;
    onClick?: MouseEventHandler;
    size?: "medium" | "small";
    type: "button" | "submit";
    variant?: "danger" | "primary" | "secondary";
  }>): ReactElement => {
  return (
    <ButtonPrimitive
      data-slot="button"
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        if (action !== undefined && type === "button") {
          startTransition(async () => {
            await action();
          });
          return;
        }
        onClick?.(event);
      }}
      className={buttonVariants({ size, variant })}
    >
      {children}
    </ButtonPrimitive>
  );
};

export { Button };
export type { ButtonAction };
