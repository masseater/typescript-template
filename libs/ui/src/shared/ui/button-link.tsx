import { createLink } from "@tanstack/react-router";

import { buttonVariants } from "./button-variants";

import type { ComponentProps, ReactElement } from "react";

type ButtonAnchorProps = Readonly<
  ComponentProps<"a"> & {
    size?: "large" | "medium" | "small";
    variant?: "danger" | "primary" | "secondary";
  }
>;

const ButtonAnchor = ({ children, size, variant, ...anchor }: ButtonAnchorProps): ReactElement => {
  return (
    <a {...anchor} data-slot="button-link" className={buttonVariants({ size, variant })}>
      {children}
    </a>
  );
};

const ButtonLink = createLink(ButtonAnchor);

export { ButtonLink };
