import { createLink } from "@tanstack/react-router";
import { Button as BaseButton } from "baseui/button";

import { kindByVariant, sizeBySize } from "./button-kinds";

import type { ComponentProps, MouseEvent, ReactElement, SyntheticEvent } from "react";

const isAnchorClick = (event: SyntheticEvent): event is MouseEvent<HTMLAnchorElement> =>
  event.currentTarget instanceof HTMLAnchorElement &&
  event.nativeEvent instanceof globalThis.MouseEvent;

const ButtonAnchor = ({
  children,
  href,
  onClick,
  size = "medium",
  target,
  variant = "secondary",
}: Readonly<
  Omit<ComponentProps<"a">, "ref"> & {
    size?: "large" | "medium" | "small";
    variant?: "danger" | "primary" | "secondary";
  }
>): ReactElement => {
  const anchorClick = (event: SyntheticEvent): void => {
    if (!isAnchorClick(event)) {
      throw new TypeError("ButtonAnchor received a click that its anchor did not dispatch");
    }
    onClick?.(event);
  };
  if (target === undefined) {
    return (
      <BaseButton
        data-slot="button-link"
        kind={kindByVariant[variant]}
        size={sizeBySize[size]}
        href={href ?? null}
        onClick={anchorClick}
      >
        {children}
      </BaseButton>
    );
  }
  return (
    <BaseButton
      data-slot="button-link"
      kind={kindByVariant[variant]}
      size={sizeBySize[size]}
      href={href ?? null}
      target={target}
      onClick={anchorClick}
    >
      {children}
    </BaseButton>
  );
};

const ButtonLink = createLink(ButtonAnchor);

export { ButtonAnchor, ButtonLink };
