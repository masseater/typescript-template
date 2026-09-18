import { createLink } from "@tanstack/react-router";
import type { ComponentProps, ReactElement } from "react";

import { buttonVariants } from "./button-variants";

type ButtonAnchorProps = Readonly<
  ComponentProps<"a"> & {
    size?: "large" | "medium" | "small";
    variant?: "danger" | "primary" | "secondary";
  }
>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function ButtonAnchor({ children, size, variant, ...anchor }: ButtonAnchorProps): ReactElement {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading
    <a {...anchor} data-slot="button-link" className={buttonVariants({ size, variant })}>
      {children}
    </a>
  );
}

const ButtonLink = createLink(ButtonAnchor);

export { ButtonLink };
