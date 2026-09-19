import { createLink } from "@tanstack/react-router";

import { buttonVariants } from "./button-variants";

import type { ComponentProps, ReactElement } from "react";

const ButtonAnchor = ({
  children,
  size,
  variant,
  ...anchor
}: Readonly<
  ComponentProps<"a"> & {
    size?: "large" | "medium" | "small";
    variant?: "danger" | "primary" | "secondary";
  }
>): ReactElement => {
  return (
    <a {...anchor} data-slot="button-link" className={buttonVariants({ size, variant })}>
      {children}
    </a>
  );
};

const ButtonLink = createLink(ButtonAnchor);

export { ButtonLink };
