import { Button as BaseButton, type ButtonProps as BaseButtonProps } from "baseui/button";
import { startTransition, type ReactElement } from "react";

import { kindByVariant, sizeBySize } from "./button-kinds";

import type { Children } from "./types";

const clickHandlerFor = (
  model: Readonly<{
    action?: (() => void | Promise<void>) | undefined;
    onClick?: BaseButtonProps["onClick"] | undefined;
    type: "button" | "submit";
  }>,
): BaseButtonProps["onClick"] | undefined => {
  const { action, onClick, type: buttonType } = model;
  if (action === undefined && onClick === undefined) {
    return undefined;
  }
  return (click) => {
    if (action !== undefined && buttonType === "button") {
      startTransition(() => {
        void action();
      });
      return;
    }
    onClick?.(click);
  };
};

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
  const clickHandler = clickHandlerFor({ action, onClick, type });
  if (ariaLabel === undefined) {
    if (clickHandler === undefined) {
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
        disabled={disabled}
        kind={buttonKind}
        size={buttonSize}
        onClick={clickHandler}
      >
        {children}
      </BaseButton>
    );
  }
  if (clickHandler === undefined) {
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
