import { createLink } from "@tanstack/react-router";
import { Button as BaseButton } from "baseui/button";

import { kindByVariant, sizeBySize } from "./button-kinds";

import type { ComponentProps, ReactElement } from "react";

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
  if (target === undefined) {
    return (
      <BaseButton
        data-slot="button-link"
        kind={kindByVariant[variant]}
        size={sizeBySize[size]}
        href={href ?? null}
        onClick={onClick as never}
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
      onClick={onClick as never}
    >
      {children}
    </BaseButton>
  );
};

const ButtonLink = createLink(ButtonAnchor);

export { ButtonLink };
