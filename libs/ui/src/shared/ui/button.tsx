import { Button as BaseButton, type ButtonProps as BaseButtonProps } from "baseui/button";
import { startTransition, type ReactElement } from "react";

import { kindByVariant, sizeBySize } from "./button-kinds";

import type { Children } from "./types";

const Button = ({
  "aria-label": ariaLabel,
  action,
  children,
  disabled = false,
  onClick,
  size = "medium",
  type,
  variant = "secondary",
}: Children &
  Readonly<{
    "aria-label"?: string;
    action?: () => void | Promise<void>;
    disabled?: boolean;
    onClick?: BaseButtonProps["onClick"];
    size?: "medium" | "small";
    type: "button" | "submit";
    variant?: "danger" | "primary" | "secondary";
  }>): ReactElement => {
  const buttonKind = kindByVariant[variant];
  const buttonSize = sizeBySize[size];
  const handleClick: BaseButtonProps["onClick"] = (click) => {
    if (action !== undefined && type === "button") {
      startTransition(() => {
        void action();
      });
      return;
    }
    onClick?.(click);
  };
  const clickHandler =
    action === undefined && onClick === undefined ? undefined : handleClick;
  if (clickHandler === undefined) {
    if (ariaLabel === undefined) {
      return (
        <BaseButton
          data-slot="button"
          type={type}
          disabled={disabled}
          kind={buttonKind}
          size={buttonSize}
        >
          {children}
        </BaseButton>
      );
    }
    return (
      <BaseButton
        data-slot="button"
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        kind={buttonKind}
        size={buttonSize}
      >
        {children}
      </BaseButton>
    );
  }
  if (ariaLabel === undefined) {
    return (
      <BaseButton
        data-slot="button"
        type={type}
        disabled={disabled}
        kind={buttonKind}
        size={buttonSize}
        onClick={clickHandler}
      >
        {children}
      </BaseButton>
    );
  }
  return (
    <BaseButton
      data-slot="button"
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      kind={buttonKind}
      size={buttonSize}
      onClick={clickHandler}
    >
      {children}
    </BaseButton>
  );
};

export { Button };
