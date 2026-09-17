import type { ComponentProps, ReactElement } from "react";
import { createLink } from "@tanstack/react-router";
import { cva } from "class-variance-authority";

const navigationLinkVariants = cva(
  "rounded-md text-foreground no-underline outline-none hover:text-foreground focus-visible:focus-indicator",
  {
    defaultVariants: { variant: "item" },
    variants: {
      variant: {
        brand: "text-lg leading-tight font-bold",
        item: "px-3 py-2 text-base leading-tight font-bold hover:bg-card-hover aria-[current=page]:bg-secondary",
      },
    },
  },
);

type NavigationAnchorProps = Readonly<ComponentProps<"a"> & { variant?: "brand" | "item" }>;

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function NavigationAnchor({ children, variant, ...anchor }: NavigationAnchorProps): ReactElement {
  return (
    // oxlint-disable-next-line react/jsx-props-no-spreading
    <a {...anchor} data-slot="navigation-link" className={navigationLinkVariants({ variant })}>
      {children}
    </a>
  );
}

const NavigationLink = createLink(NavigationAnchor);

export { NavigationLink };
